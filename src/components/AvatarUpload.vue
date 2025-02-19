<template>
    <div class="avatar-upload-page">
      <div class="avatar-upload-container">
        <!-- Header -->
        <div class="avatar-upload-header">
          <h3>Update Profile Photo</h3>
          <button class="close-button" @click="$router.push('/')" aria-label="Close upload dialog">&times;</button>
        </div>
        
        <!-- Upload Area -->
        <div
          class="upload-area"
          :class="{ 'drag-over': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          role="region"
          aria-label="Avatar upload area"
        >
          <div v-if="preview" class="preview-container">
            <img :src="preview" alt="Avatar preview" class="avatar-preview" />
            <button class="change-image" @click="selectFile">Change Image</button>
          </div>
          <div v-else class="upload-placeholder">
            <img :src="avatar || '/user-avatar.svg'" alt="Current avatar" class="current-avatar" />
            <p>Drag & drop an image here or</p>
            <button @click="selectFile">Select a File</button>
          </div>
        </div>
        
        <!-- Hidden File Input -->
        <input ref="fileInput" type="file" @change="handleFileChange" accept="image/jpeg, image/png, image/gif" hidden />
        
        <!-- Error Message -->
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        
        <!-- Action Buttons -->
        <div class="upload-actions">
          <button class="upload-button" @click="uploadAvatar" :disabled="!preview || uploading">{{ uploading ? "Uploading..." : "Upload Avatar" }}</button>
          <button class="cancel-button" @click="$router.push('/')" :disabled="uploading">Cancel</button>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, onMounted } from 'vue';
  import { useContactStore } from '../stores/contacts';
  import { useRoute, useRouter } from 'vue-router';
  
  export default {
    setup() {
      const route = useRoute();
      const router = useRouter();
      const contactStore = useContactStore();
      const fileInput = ref(null);
      const preview = ref(null);
      const avatar = ref(null);
      const uploading = ref(false);
      const error = ref("");
      const isDragging = ref(false);
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
      
      onMounted(async () => {
        try {
          const contact = await contactStore.getContactById(route.params.id);
          avatar.value = contact?.photo;
        } catch {
          error.value = "Failed to fetch contact information";
        }
      });
      
      const selectFile = () => fileInput.value.click();
      
      const handleFileChange = (event) => {
        validateAndPreviewFile(event.target.files[0]);
      };
      
      const handleDrop = (event) => {
        isDragging.value = false;
        validateAndPreviewFile(event.dataTransfer.files[0]);
      };
      
      const validateAndPreviewFile = (file) => {
        if (!file || !ACCEPTED_FILE_TYPES.includes(file.type)) {
          error.value = "Only images (JPEG, PNG, GIF) are allowed";
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          error.value = "Image size must not exceed 5 MB";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          preview.value = reader.result;
          error.value = "";
        };
        reader.readAsDataURL(file);
      };
      
      const uploadAvatar = async () => {
        if (!preview.value) return;
        try {
          uploading.value = true;
          error.value = "";
          const response = await fetch(preview.value);
          const blob = await response.blob();
          const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
          const formData = new FormData();
          formData.append("photo", file);
          await contactStore.updateAvatar(route.params.id, formData);
          router.push("/");
        } catch {
          error.value = "Failed to upload avatar";
        } finally {
          uploading.value = false;
        }
      };
      
      return { preview, avatar, uploading, error, isDragging, selectFile, handleFileChange, handleDrop, uploadAvatar };
    }
  };
  </script>
  
  <style scoped>
  .avatar-upload-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: rgba(0, 0, 0, 0.5);
  }
  .avatar-upload-container {
      padding: 20px;
      background: white;
      border-radius: 5px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  .avatar-upload-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
  }
  .upload-area {
    padding: 20px;
    border: 2px dashed #ccc;
    text-align: center;
  }
  .drag-over {
    border-color: green;
  }
  .avatar-preview {
    max-width: 100px;
    border-radius: 50%;
  }
  .error-message {
    color: red;
    font-size: 14px;
  }
  .upload-actions {
    display: flex;
    gap: 10px;
  }
  .upload-button, .cancel-button {
    padding: 8px 12px;
    border: none;
    cursor: pointer;
  }
  .upload-button {
    background: blue;
    color: white;
  }
  .cancel-button {
    background: gray;
    color: white;
  }
  </style>
  