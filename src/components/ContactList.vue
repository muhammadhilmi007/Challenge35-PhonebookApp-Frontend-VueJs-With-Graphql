<template>
  <div v-if="!contacts.length" class="contact-list-empty" role="status">
    <p>No contacts available</p>
  </div>
  
  <div v-else class="contact-list">
    <!-- Contact Cards -->
    <div 
      v-for="(contact, index) in contacts" 
      :key="contact.id" 
      ref="(el) => setLastContactRef(el, index)"
      :class="['contact-list-item', { pending: contact.status === 'pending' }]"
    >
      <ContactCard 
        :contact="contact"
        @edit="onEdit"
        @delete="onDelete"
        @avatar-update="onAvatarUpdate"
        @resend-success="onResendSuccess"
        @refresh-contacts="onRefreshContacts"
      />
    </div>
    
    <!-- Loading State -->
    <div v-if="hasMore" class="loading-more" role="status">
      Loading more...
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useContactStore } from '../stores/contacts';
import ContactCard from '../components/ContactCard.vue';

export default {
  components: { ContactCard },
  props: {
    contacts: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    hasMore: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const contactStore = useContactStore();
    const lastContactRef = ref(null);
    let observer = null;

    const setLastContactRef = (el, index) => {
      if (index === props.contacts.length - 1) {
        lastContactRef.value = el;
      }
    };

    // Setup infinite scroll observer
    onMounted(() => {
      observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && props.hasMore && !props.loading) {
          contactStore.loadMoreContacts();
        }
      }, { root: null, rootMargin: '20px', threshold: 0.1 });
      
      if (lastContactRef.value) {
        observer.observe(lastContactRef.value);
      }
    });

    onBeforeUnmount(() => {
      if (observer) observer.disconnect();
    });

    // Watch contacts list and update observer
    watch(() => props.contacts, () => {
      if (lastContactRef.value) {
        observer.observe(lastContactRef.value);
      }
    });

    return {
      setLastContactRef,
      onEdit: contactStore.editContact,
      onDelete: contactStore.deleteContact,
      onAvatarUpdate: contactStore.updateAvatar,
      onRefreshContacts: contactStore.fetchContacts,
      onResendSuccess: contactStore.handleResendSuccess
    };
  }
};
</script>

<style scoped>
.contact-list-empty {
  text-align: center;
  font-size: 1.2em;
  margin-top: 20px;
}
.loading-more {
  text-align: center;
  font-weight: bold;
  margin-top: 20px;
}
</style>
