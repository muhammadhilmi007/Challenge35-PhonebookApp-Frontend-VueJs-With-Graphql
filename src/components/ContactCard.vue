<template>
  <div class="contact-card">
    <div class="card-content">
      <!-- Avatar Section -->
      <div class="avatar" @click="handleAvatarClick" role="button" aria-label="Update avatar">
        <img :src="contact.photo || '/default-avatar.svg'" :alt="`${contact.name}'s avatar`" />
      </div>

      <!-- Contact Information -->
      <div class="contact-info">
        <div v-if="isEditing" class="edit-form">
          <input v-model="form.name" type="text" placeholder="Name" class="edit-input" aria-label="Edit contact name" />
          <input v-model="form.phone" type="tel" placeholder="Phone" class="edit-input"
            aria-label="Edit contact phone" />
          <div class="edit-buttons">
            <button @click="saveChanges">Save</button>
            <button @click="isEditing = false">Cancel</button>
          </div>
        </div>
        <div v-else class="contact-details">
          <h3>{{ contact.name }}</h3>
          <p>{{ contact.phone }}</p>
          <span v-if="contact.status === 'pending'" class="pending-badge">Pending</span>
        </div>

        <!-- Action Buttons - Only show when modal is not visible -->
        <div class="contact-actions" v-show="!showDeleteModal">
          <button 
            v-if="contact.status === 'pending'"
            @click="handleResend" 
            class="resend-button"
            :disabled="resending">
            <font-awesome-icon :icon="resending ? 'spinner' : 'sync'" :spin="resending" />
          </button>
          <template v-else>
            <button v-if="!isEditing" @click="isEditing = true" aria-label="Edit contact" class="action-button edit">
              <font-awesome-icon icon="edit" />
            </button>
            <button 
              v-if="!isEditing" 
              @click="showDeleteModal = true"
              class="action-button delete"
              aria-label="Delete contact">
              <font-awesome-icon icon="trash" />
            </button>
          </template>
        </div>

        <!-- Inline Delete Confirmation Modal -->
        <div v-if="showDeleteModal" class="card-modal">
          <div class="card-modal-content">
            <p>Delete {{ contact.name }}?</p>
            <div class="modal-buttons">
              <button @click="confirmDelete" class="delete-btn">Delete</button>
              <button @click="showDeleteModal = false" class="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { useContactStore } from '../stores/contacts';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = defineProps(['contact']);
const emit = defineEmits(['contact-updated']);
const router = useRouter();
const contactStore = useContactStore();

const isEditing = ref(false);
const form = ref({ name: props.contact.name, phone: props.contact.phone });
const resending = ref(false);
const showDeleteConfirm = ref(false);
let deleteTimeout = null;

const showDeleteModal = ref(false);

const confirmDelete = async () => {
  try {
    await contactStore.deleteContact(props.contact.id);
    await contactStore.resetAndFetchContacts();
    showDeleteModal.value = false;
  } catch (err) {
    console.error('Failed to delete contact:', err);
  }
};

// Modified delete handling
const handleDeleteClick = () => {
  if (showDeleteConfirm.value) {
    deleteContact();
  } else {
    showDeleteConfirm.value = true;
    // Auto-reset after 3 seconds
    deleteTimeout = setTimeout(() => {
      showDeleteConfirm.value = false;
    }, 3000);
  }
};

// Cleanup timeout
onBeforeUnmount(() => {
  if (deleteTimeout) {
    clearTimeout(deleteTimeout);
  }
});

const deleteContact = async () => {
  try {
    await contactStore.deleteContact(props.contact.id);
    await contactStore.resetAndFetchContacts();
  } catch (err) {
    console.error('Failed to delete contact:', err);
  }
};

// Updated to use store actions directly
const saveChanges = async () => {
  if (!form.value.name.trim() || !form.value.phone.trim()) return;
  try {
    await contactStore.updateContact(props.contact.id, { ...form.value });
    isEditing.value = false;
    // Remove emit since we're handling refresh directly
    await contactStore.resetAndFetchContacts();
  } catch (err) {
    console.error('Failed to update contact:', err);
  }
};

const handleResend = async () => {
  if (resending.value) return;
  
  resending.value = true;
  try {
    await contactStore.resendPendingContact(props.contact.id);
  } catch (error) {
    console.error('Resend failed:', error);
  } finally {
    resending.value = false;
  }
};

const handleAvatarClick = () => {
  if (props.contact?.id) {
    router.push(`/avatar/${props.contact.id}`);
  }
};
</script>

<style scoped>
/* Add these new styles */
.action-button.delete {
  position: relative;
  transition: all 0.3s ease;
}

.action-button.confirm-delete {
  background-color: #ff4444;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
}

.delete-confirm-text {
  font-size: 12px;
  margin-left: 4px;
}

/* Update existing contact-actions styles */
.contact-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.contact-actions button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.contact-actions button:hover {
  transform: scale(1.05);
}

.action-button.delete:hover {
  color: #ff4444;
}

.action-button.confirm-delete:hover {
  background-color: #ff2020;
  color: white;
}
.resend-button {
  color: #000;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.resend-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Add new inline modal styles */
.card-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.98); /* Increased opacity for better coverage */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  animation: fadeIn 0.2s ease-out;
  z-index: 2; /* Ensure modal is above other content */
}

.card-modal-content {
  text-align: center;
  padding: 20px;
  width: 100%;
}

.card-modal-content p {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: 500;
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.modal-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.delete-btn {
  background: #ff4444;
  color: white;
}

.delete-btn:hover {
  background: #ff2020;
}

.cancel-btn {
  background: #f0f0f0;
  color: #333;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Make contact card position relative for absolute modal positioning */
.contact-card {
  position: relative;
  overflow: hidden;
}

/* Adjust existing styles */
.contact-actions {
  z-index: 1;
}

.contact-info {
  position: relative;
}
</style>
