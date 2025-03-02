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

        <!-- Action Buttons -->
        <div class="contact-actions">
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
          <!-- Modified delete button with inline confirmation -->
          <button 
            v-if="!isEditing" 
            @click="handleDeleteClick" 
            :class="['action-button', 'delete', { 'confirm-delete': showDeleteConfirm }]"
            aria-label="Delete contact"
          >
            <font-awesome-icon :icon="showDeleteConfirm ? 'check' : 'trash'" />
            <span v-if="showDeleteConfirm" class="delete-confirm-text">Hapus?</span>
          </button>
        </template>
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
</style>
