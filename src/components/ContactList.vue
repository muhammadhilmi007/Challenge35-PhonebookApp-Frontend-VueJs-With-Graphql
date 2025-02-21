<template>
  <div v-if="!contacts.length && !loading" class="contact-list-empty" role="status">
    <p>No contacts available</p>
  </div>

  <div v-else class="contact-list">
    <!-- Contact Cards -->
    <div 
      v-for="(contact, index) in contacts" 
      :key="contact.id"
      :class="['contact-list-item', { pending: contact.status === 'pending' }]"
      :ref="(el) => setLastContactRef(el, index)"
    >
      <ContactCard 
        :contact="contact"
        @edit="onEdit"
        @delete="onDelete"
        @avatar-update="onAvatarUpdate"
        @resend-success="onResendSuccess"
        @refresh-contacts="onRefreshContacts"
        @contact-updated="handleContactUpdate"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state" role="status">
      <div class="loading-spinner"></div>
      <p>Loading contacts...</p>
    </div>

    <!-- Load More Trigger -->
    <div 
      v-if="hasMore && !loading" 
      ref="loadMoreTrigger"
      class="load-more-trigger"
    ></div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { useContactStore } from '../stores/contacts';
import ContactCard from './ContactCard.vue';

export default {
  components: { ContactCard },
  setup() {
    const contactStore = useContactStore();
    const lastContactRef = ref(null);
    const observer = ref(null);
    const isLoadingMore = ref(false);

    const contacts = computed(() => contactStore.contacts);
    const loading = computed(() => contactStore.loading);
    const hasMore = computed(() => contactStore.hasMore);

    // Modified setLastContactRef with error handling
    const setLastContactRef = async (el, index) => {
      try {
        if (index === contacts.value.length - 1 && el !== lastContactRef.value) {
          lastContactRef.value = el;
          await nextTick();
          setupIntersectionObserver();
        }
      } catch (error) {
        console.error('Error setting last contact ref:', error);
      }
    };

    // Optimized intersection observer setup
    const setupIntersectionObserver = () => {
      if (observer.value) {
        observer.value.disconnect();
      }

      observer.value = new IntersectionObserver(
        async (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && hasMore.value && !loading.value && !isLoadingMore.value) {
            isLoadingMore.value = true;
            try {
              await contactStore.loadMoreContacts();
            } finally {
              isLoadingMore.value = false;
            }
          }
        },
        {
          root: null,
          rootMargin: '100px',
          threshold: 0.1
        }
      );

      if (lastContactRef.value) {
        observer.value.observe(lastContactRef.value);
      }
    };

    // Optimized watch to prevent unnecessary observer resets
    watch([hasMore, loading], ([newHasMore, newLoading], [oldHasMore, oldLoading]) => {
      if (newHasMore && !newLoading && (oldHasMore !== newHasMore || oldLoading !== newLoading)) {
        nextTick(() => {
          setupIntersectionObserver();
        });
      }
    });

    const handleContactUpdate = (updatedContact) => {
      contactStore.handleContactUpdate(updatedContact);
    };

    onMounted(async () => {
      await contactStore.resetAndFetchContacts();
      setupIntersectionObserver();
    });

    onBeforeUnmount(() => {
      if (observer.value) {
        observer.value.disconnect();
        observer.value = null;
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

<style scoped>
.contact-list {
  position: relative;
  min-height: 200px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.loading-spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

.load-more-trigger {
  height: 20px;
  margin-top: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>