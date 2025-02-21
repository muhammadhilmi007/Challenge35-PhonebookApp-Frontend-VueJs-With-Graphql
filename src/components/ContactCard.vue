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
          <button v-if="contact.status === 'pending'" @click="handleResend" aria-label="Resend contact"
            class="action-button resend">
            <font-awesome-icon icon="sync" />
          </button>
          <button v-else-if="!isEditing" @click="isEditing = true" aria-label="Edit contact" class="action-button edit">
            <font-awesome-icon icon="edit" />
          </button>
          <button v-if="!isEditing" @click="showDelete = true" aria-label="Delete contact" class="action-button delete">
            <font-awesome-icon icon="trash" />
          </button>
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
import { useRouter } from 'vue-router';

export default {
  props: ['contact'],
  setup(props) {
    const router = useRouter();
    const contactStore = useContactStore();
    const isEditing = ref(false);
    const showDelete = ref(false);
    const form = ref({ name: props.contact.name, phone: props.contact.phone });

    const saveChanges = async () => {
      if (!form.value.name.trim() || !form.value.phone.trim()) return;
      // Changed editContact to updateContact to match the store method
      try {
        const updatedContact = await contactStore.updateContact(props.contact.id, { ...form.value });
        isEditing.value = false;
        // Emit event to parent with updated contact data
        emit('contact-updated', updatedContact);
      } catch (err) {
        console.error('Failed to update contact:', err);
      }
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

    const handleAvatarClick = () => {
      if (props.contact && props.contact.id) {
        router.push(`/avatar/${props.contact.id}`);
      }
    };

    return {
      isEditing,
      showDelete,
      form,
      saveChanges,
      deleteContact,
      handleResend,
      onAvatarUpdate: (id) => contactStore.updateAvatar(id, props.contact.photo),
      handleAvatarClick
    };
  }
};
</script>
