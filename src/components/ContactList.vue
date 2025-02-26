<template>
  <div v-if="!contacts.length && !loading" class="contact-list-empty" role="status">
    <p>No contacts available</p>
  </div>

  <div v-else class="contact-list">
    <!-- Contact Cards -->
    <TransitionGroup name="contact-list">
      <div 
        v-for="(contact, index) in contacts" 
        :key="`${contact.id}-${contact.status || 'regular'}`"
        :class="['contact-list-item', { pending: contact.status === 'pending' }]"
        :ref="el => index === contacts.length - 1 && setLastContactRef(el)"
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
    </TransitionGroup>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state" role="status" aria-live="polite">
      <div class="loading-spinner"></div>
      <p>Loading contacts...</p>
    </div>

    <!-- Load More Trigger -->
    <div 
      v-if="hasMore && !loading" 
      ref="loadMoreTrigger"
      class="load-more-trigger"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick, shallowRef } from 'vue';
import { useContactStore } from '../stores/contacts';
import ContactCard from './ContactCard.vue';

const contactStore = useContactStore();
const lastContactRef = shallowRef(null);
const observer = ref(null);
const isLoadingMore = ref(false);
const isObserverSetup = ref(false);

// Memoized computed properties
const contacts = computed(() => contactStore.contacts);
const loading = computed(() => contactStore.loading);
const hasMore = computed(() => contactStore.hasMore);

// Simplified setLastContactRef - doesn't need debouncing
const setLastContactRef = (el) => {
  if (!el || el === lastContactRef.value) return;
  
  lastContactRef.value = el;
  nextTick(() => {
    if (hasMore.value && !loading.value) {
      setupIntersectionObserver(el);
    }
  });
};

// Optimized intersection observer
const setupIntersectionObserver = (el) => {
  if (observer.value) {
    observer.value.disconnect();
  }

  observer.value = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMore.value && !loading.value && !isLoadingMore.value) {
        loadMoreContacts();
      }
    },
    {
      root: null,
      rootMargin: '200px', // Pre-loading margin
      threshold: 0.1
    }
  );

  if (el) {
    observer.value.observe(el);
  }
  isObserverSetup.value = true;
};

// Extract loadMoreContacts logic into a separate function
const loadMoreContacts = async () => {
  if (isLoadingMore.value) return;
  
  isLoadingMore.value = true;
  try {
    await contactStore.loadMoreContacts();
  } catch (error) {
    console.error('Error loading more contacts:', error);
  } finally {
    isLoadingMore.value = false;
  }
};

// Remove the handleContactUpdate function and replace with direct contact update handling
const handleContactUpdate = async (updatedContact) => {
  try {
    await contactStore.resetAndFetchContacts();
  } catch (error) {
    console.error('Error refreshing contacts:', error);
  }
};

// Watch for changes in contacts, hasMore, or loading
watch([contacts, hasMore, loading], ([newContacts, newHasMore, newLoading]) => {
  nextTick(() => {
    if (newHasMore && !newLoading && !isObserverSetup.value && newContacts.length > 0) {
      setupIntersectionObserver(lastContactRef.value);
    }
  });
});

// Initialize component
onMounted(async () => {
  try {
    await contactStore.resetAndFetchContacts();
  } catch (error) {
    console.error('Error initializing contacts:', error);
  }
});

// Cleanup resources
onBeforeUnmount(() => {
  if (observer.value) {
    observer.value.disconnect();
    observer.value = null;
  }
});

// Methods exposed to template
const onEdit = contactStore.updateContact;
const onDelete = contactStore.deleteContact;
const onAvatarUpdate = contactStore.updateAvatar;
const onRefreshContacts = () => contactStore.resetAndFetchContacts();
const onResendSuccess = contactStore.handleResendSuccess;
</script>

<style scoped>
.contact-list {
  position: relative;
  min-height: 200px;
  will-change: transform; /* Optimize animations */
  contain: content; /* Improve rendering performance */
}

/* Animation for contact list items */
.contact-list-enter-active,
.contact-list-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.contact-list-enter-from,
.contact-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
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