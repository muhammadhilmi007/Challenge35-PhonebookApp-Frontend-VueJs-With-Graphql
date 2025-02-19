<template>
  <div class="contact-card">
    <div class="card-content">
      <!-- Avatar Section -->
      <div class="avatar" @click="onAvatarUpdate(contact.id)" role="button" aria-label="Update avatar">
        <img :src="contact.photo || '/user-avatar.svg'" :alt="`${contact.name}'s avatar`" />
      </div>

      <!-- Contact Information -->
      <div class="contact-info">
        <div v-if="isEditing" class="edit-form">
          <input v-model="form.name" type="text" placeholder="Name" class="edit-input" aria-label="Edit contact name" />
          <input v-model="form.phone" type="tel" placeholder="Phone" class="edit-input" aria-label="Edit contact phone" />
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
          <button v-if="contact.status === 'pending'" @click="handleResend" aria-label="Resend contact" class="action-button resend">
            🔄
          </button>
          <button v-else @click="isEditing = true" aria-label="Edit contact" class="action-button edit">✏️</button>
          <button v-if="!isEditing" @click="showDelete = true" aria-label="Delete contact" class="action-button delete">🗑️</button>
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

<script>
import { ref } from 'vue';
import { useContactStore } from '../stores/contacts';

export default {
  props: ['contact'],
  setup(props) {
    const contactStore = useContactStore();
    const isEditing = ref(false);
    const showDelete = ref(false);
    const form = ref({ name: props.contact.name, phone: props.contact.phone });

    const saveChanges = async () => {
      if (!form.value.name.trim() || !form.value.phone.trim()) return;
      // Changed editContact to updateContact to match the store method
      await contactStore.updateContact(props.contact.id, { ...form.value });
      isEditing.value = false;
    };

    const deleteContact = async () => {
      await contactStore.deleteContact(props.contact.id);
      showDelete.value = false;
    };

    const handleResend = async () => {
      if (contactStore.resendContact) {
        await contactStore.resendContact(props.contact.id);
      }
      contactStore.fetchContacts();
    };

    return {
      isEditing,
      showDelete,
      form,
      saveChanges,
      deleteContact,
      handleResend,
      onAvatarUpdate: (id) => contactStore.updateAvatar(id, props.contact.photo)
    };
  }
};
</script>

<style scoped>
.contact-card {
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  padding: 10px;
  border-radius: 5px;
  background-color: white;
}
.card-content {
  display: flex;
  align-items: center;
}
.avatar img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}
.contact-details {
  flex-grow: 1;
  margin-left: 10px;
}
.action-button {
  margin-left: 5px;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-dialog {
  background: white;
  padding: 20px;
  border-radius: 5px;
}
</style>
