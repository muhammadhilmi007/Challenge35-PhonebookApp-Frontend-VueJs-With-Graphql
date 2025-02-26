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
          <button v-if="!isEditing" @click="showDelete = true" aria-label="Delete contact" class="action-button delete">
            <font-awesome-icon icon="trash" />
          </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDelete" class="modal-overlay" role="dialog" aria-modal="true">
      <div class="confirm-dialog">
        <p>Are you sure you want to delete this contact?</p>
        <div class="confirm-buttons">
          <button @click="deleteContact">Yes</button>
          <button @click="showDelete = false">No</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useContactStore } from '../stores/contacts';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = defineProps(['contact']);
const emit = defineEmits(['contact-updated']);
const router = useRouter();
const contactStore = useContactStore();

const isEditing = ref(false);
const showDelete = ref(false);
const form = ref({ name: props.contact.name, phone: props.contact.phone });
const resending = ref(false);

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

const deleteContact = async () => {
  try {
    await contactStore.deleteContact(props.contact.id);
    showDelete.value = false;
    await contactStore.resetAndFetchContacts();
  } catch (err) {
    console.error('Failed to delete contact:', err);
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
