<script>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useContactStore } from "../stores/contacts";

export default {
  setup() {
    const router = useRouter();
    const contactStore = useContactStore();
    
    // State
    const form = ref({ name: "", phone: "" });
    const error = ref("");
    const saving = ref(false);
    
    // Save Contact
    const saveContact = async () => {
      if (!form.value.name.trim() || !form.value.phone.trim()) {
        error.value = "Name and phone are required";
        return;
      }

      saving.value = true;
      const newContact = { 
        name: form.value.name.trim(), 
        phone: form.value.phone.trim() 
      };
      
      try {
        if (!navigator.onLine) {
          await contactStore.addContactOffline(newContact);
          await contactStore.fetchContacts();
          navigateBack();
          return;
        }

        try {
          await contactStore.addContact(newContact);
          await contactStore.fetchContacts();
          navigateBack();
        } catch (err) {
          if (!navigator.onLine || err.message.includes('ECONNREFUSED')) {
            await contactStore.addContactOffline(newContact);
            // await contactStore.fetchContacts();
            navigateBack();
          } else {
            throw err;
          }
        }
      } catch (err) {
        error.value = "Failed to save contact";
        console.error('Failed to save contact:', err);
      } finally {
        saving.value = false;
      }
    };
    
    // Navigate Back
    const navigateBack = () => {
      const params = new URLSearchParams();
      const savedValues = {
        search: sessionStorage.getItem("contactSearch"),
        sortBy: sessionStorage.getItem("contactSortBy"),
        sortOrder: sessionStorage.getItem("contactSortOrder"),
      };
      if (sessionStorage.getItem("searchActive") && savedValues.search) {
        params.append("search", savedValues.search);
      }
      Object.entries(savedValues).forEach(([key, value]) => {
        if (value && key !== "search") {
          params.append(key, value);
        }
      });
      router.replace(params.toString() ? `/?${params.toString()}` : "/");
    };
    
    return { 
      form, 
      error, 
      saving, 
      saveContact, 
      navigateBack 
    };
  }
};
</script>

<template>
  <div class="add-view">
    <h2>Add Contact</h2>
    
    <!-- Error Message -->
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    
    <!-- Add Contact Form -->
    <form @submit.prevent="saveContact" class="add-form">
      <input
        type="text"
        placeholder="Name"
        v-model="form.name"
        required
        class="add-input"
        :disabled="saving"
      />
      <input
        type="tel"
        placeholder="Phone"
        v-model="form.phone"
        required
        class="add-input"
        :disabled="saving"
      />
      
      <!-- Form Actions -->
      <div class="add-form-actions">
        <button type="submit" class="save-button" :disabled="saving">
          {{ saving ? "Saving..." : "Save" }}
        </button>
        <button type="button" class="cancel-button" @click="navigateBack" :disabled="saving">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
