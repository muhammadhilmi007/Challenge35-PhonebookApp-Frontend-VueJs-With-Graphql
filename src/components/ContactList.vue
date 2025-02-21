<template>
  <div v-if="!contacts.length" class="contact-list-empty" role="status">
    <p>No contacts available</p>
  </div>

  <div v-else class="contact-list">
    <!-- Contact Cards -->
    <div v-for="(contact, index) in contacts" :key="contact.id"
      :class="['contact-list-item', { pending: contact.status === 'pending' }]"
      :ref="index === contacts.length - 1 ? setLastContactRef : undefined">
      <ContactCard :contact="contact" @edit="onEdit" @delete="onDelete" @avatar-update="onAvatarUpdate"
        @resend-success="onResendSuccess" @refresh-contacts="onRefreshContacts" @contact-updated="handleContactUpdate" />
    </div>

    <!-- Loading State -->
    <div v-if="hasMore" class="loading-more" role="status">
      Loading more...
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useContactStore } from '../stores/contacts';
import ContactCard from './ContactCard.vue';

export default {
  components: { ContactCard },
  setup() {
    const contactStore = useContactStore();
    const lastContactRef = ref(null);
    const observer = ref(null);

    const contacts = computed(() => contactStore.contacts);
    const loading = computed(() => contactStore.loading);
    const hasMore = computed(() => contactStore.hasMore);

    const handleContactUpdate = (updatedContact) => {
      // Check if updated contact still matches search criteria
      const searchTerm = contactStore.search.toLowerCase();
      if (searchTerm) {
        const matchesSearch =
          updatedContact.name.toLowerCase().includes(searchTerm) ||
          updatedContact.phone.toLowerCase().includes(searchTerm);

        if (!matchesSearch) {
          // Remove contact from current view if it no longer matches
          contactStore.removeFromCurrentView(updatedContact.id);
        }
      }
    };

    const setLastContactRef = (el) => {
      if (el) {
        lastContactRef.value = el;
        setupObserver();
      }
    };

    const setupObserver = () => {
      if (observer.value) {
        observer.value.disconnect();
      }

      observer.value = new IntersectionObserver(
        async (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && hasMore.value && !loading.value) {
            // Add debounce to prevent multiple calls
            await contactStore.loadMoreContacts();
          }
        },
        {
          root: null,
          rootMargin: '100px', // Increased for better pre-loading
          threshold: 0.1
        }
      );

      if (lastContactRef.value) {
        observer.value.observe(lastContactRef.value);
      }
    };

    onMounted(() => {
      contactStore.resetAndFetchContacts();
    });

    onBeforeUnmount(() => {
      if (observer.value) {
        observer.value.disconnect();
      }
    });

    return {
      contacts,
      loading,
      hasMore,
      setLastContactRef,
      handleContactUpdate,
      onEdit: contactStore.updateContact,
      onDelete: contactStore.deleteContact,
      onAvatarUpdate: contactStore.updateAvatar,
      onRefreshContacts: contactStore.fetchContacts,
      onResendSuccess: contactStore.handleResendSuccess
    };
  }
};
</script>