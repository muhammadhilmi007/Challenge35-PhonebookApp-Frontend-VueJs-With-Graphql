<template>
  <div v-if="!contacts.length && !loading" class="contact-list-empty" role="status">
    <p>No contacts available</p>
  </div>

  <div v-else class="contact-list">
    <!-- Contact Cards -->
    <div 
      v-for="(contact, index) in contacts" 
      :key="`${contact.id}-${contact.status || 'regular'}`"
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
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick, shallowRef } from 'vue';
import { useContactStore } from '../stores/contacts';
import ContactCard from './ContactCard.vue';

export default {
  components: { ContactCard },
  setup() {
    const contactStore = useContactStore();
    // Use shallowRef for better performance with large lists
    const lastContactRef = shallowRef(null);
    const observer = shallowRef(null);
    const isLoadingMore = shallowRef(false);

    // Memoized computed properties
    const contacts = computed(() => contactStore.contacts);
    const loading = computed(() => contactStore.loading);
    const hasMore = computed(() => contactStore.hasMore);

    // Optimized setLastContactRef with debouncing
    let debounceTimer;
    const setLastContactRef = (el, index) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          if (index === contacts.value.length - 1 && el !== lastContactRef.value) {
            lastContactRef.value = el;
            await nextTick();
            setupIntersectionObserver();
          }
        } catch (error) {
          console.error('Error setting last contact ref:', error);
        }
      }, 100);
    };

    // Optimized intersection observer with better performance options
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
          rootMargin: '200px', // Increased for better pre-loading
          threshold: 0.1
        }
      );

      if (lastContactRef.value) {
        observer.value.observe(lastContactRef.value);
      }
    };

    // Optimized watch with immediate option
    watch([hasMore, loading], ([newHasMore, newLoading], [oldHasMore, oldLoading]) => {
      if (newHasMore && !newLoading && (oldHasMore !== newHasMore || oldLoading !== newLoading)) {
        nextTick(() => setupIntersectionObserver());
      }
    }, { immediate: true });

    // Improved error handling for contact updates
    const handleContactUpdate = async (updatedContact) => {
      try {
        await contactStore.handleContactUpdate(updatedContact);
        await contactStore.resetAndFetchContacts();
      } catch (error) {
        console.error('Error handling contact update:', error);
        // Add user feedback here if needed
      }
    };

    // Cleanup on component unmount
    onBeforeUnmount(() => {
      if (observer.value) {
        observer.value.disconnect();
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    });

    // Initialize contacts with error handling
    onMounted(async () => {
      try {
        await contactStore.resetAndFetchContacts();
        setupIntersectionObserver();
      } catch (error) {
        console.error('Error initializing contacts:', error);
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
      onRefreshContacts: () => contactStore.resetAndFetchContacts(),
      onResendSuccess: contactStore.handleResendSuccess
    };
  }
};
</script>

<style scoped>
.contact-list {
  position: relative;
  min-height: 200px;
  will-change: transform; /* Optimize animations */
  contain: content; /* Improve rendering performance */
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