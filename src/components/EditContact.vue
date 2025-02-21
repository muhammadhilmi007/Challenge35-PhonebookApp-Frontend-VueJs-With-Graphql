<template>
    <div class="edit-contact">
      <h2>Edit Contact</h2>
      
      <!-- Edit Form -->
      <form @submit.prevent="saveContact" class="edit-form">
        <!-- Name Input -->
        <div class="form-group">
          <label for="name">Name:</label>
          <input
            v-model="form.name"
            type="text"
            id="name"
            placeholder="Enter name"
            class="edit-input"
            :class="{ error: error && !form.name.trim() }"
            aria-label="Contact name"
            required
          />
        </div>
        
        <!-- Phone Input -->
        <div class="form-group">
          <label for="phone">Phone:</label>
          <input
            v-model="form.phone"
            type="tel"
            id="phone"
            placeholder="Enter phone number"
            class="edit-input"
            :class="{ error: error && !form.phone.trim() }"
            aria-label="Contact phone"
            required
          />
        </div>
        
        <!-- Error Display -->
        <div v-if="error" class="error-message" role="alert">
          {{ error }}
        </div>
        
        <!-- Form Actions -->
        <div class="form-actions">
          <button type="submit" class="save-button">Save</button>
          <button type="button" @click="onCancel" class="cancel-button">Cancel</button>
        </div>
      </form>
    </div>
  </template>
  
  <script>
  import { ref, reactive } from 'vue';
  import { useContactStore } from '../stores/contacts';
  
  export default {
    props: ['contact', 'onCancel'],
    setup(props) {
      const contactStore = useContactStore();
      const form = reactive({ name: props.contact.name, phone: props.contact.phone });
      const error = ref('');
  
      const saveContact = async () => {
        if (!form.name.trim() || !form.phone.trim()) {
          error.value = 'Name and phone number are required';
          return;
        }
  
        try {
          await contactStore.editContact(props.contact.id, { ...form });
          props.onCancel();
        } catch (err) {
          error.value = 'Failed to update contact';
        }
      };
  
      return { form, error, saveContact };
    }
  };
  </script>
  