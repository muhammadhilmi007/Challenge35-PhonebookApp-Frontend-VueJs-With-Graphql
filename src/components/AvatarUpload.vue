<template>
  <div class="avatar-upload-page">
    <div class="avatar-upload-container">
      <!-- Header -->
      <div class="avatar-upload-header" v-memo>
        <h3>Update Profile Photo</h3>
        <button class="close-button" @click="$router.push('/')" aria-label="Close upload dialog">&times;</button>
      </div>

      <!-- <div v-show="isMobile" class="upload-options">
        <button @click="startCamera" class="upload-option">
          <span>Take Photo</span>
        </button>
      </div> -->

      <!-- Camera View -->
      <div v-show="showCamera" class="camera-container">
        <video ref="video" autoplay playsinline></video>
        <button @click="capturePhoto" class="camera-button">Take Photo</button>
        <button @click="stopCamera" class="camera-button cancel">Cancel</button>
      </div>

      <!-- Upload Area -->
      <div class="upload-area" :class="{ 'drag-over': isDragging }" @dragover.prevent="handleDragOver = true"
        @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop" role="region"
        aria-label="Avatar upload area">
        <div v-if="preview" class="preview-container">
          <img :src="preview" alt="Avatar preview" class="avatar-preview" />
          <button class="change-image" @click="selectFile">Change Image</button>
        </div>
        <div v-else class="upload-placeholder">
          <img :src="avatar || '/default-avatar.svg'" alt="Current avatar" class="current-avatar" />
          <p>Drag & drop an image here or</p>
          <button @click="selectFile" class="select-file-button">Select a File</button>
        </div>
      </div>

      <!-- Hidden File Input -->
      <input ref="fileInput" type="file" @change="handleFileChange" accept="image/jpeg, image/png, image/gif"
        capture="environment" hidden />

      <!-- Error Message -->
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>

      <!-- Action Buttons -->
      <div class="upload-actions">
        <button class="upload-button" @click="uploadAvatar" :disabled="!preview || uploading">
          {{ uploading ? "Uploading..." : "Upload Avatar" }}
        </button>
        <button class="cancel-button" @click="$router.push('/')" :disabled="uploading">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
    const video = ref(null);
    const showCamera = ref(false);
    const isMobile = ref(/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent));

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (video.value) {
          video.value.srcObject = stream;
          showCamera.value = true;
        }
      } catch (err) {
        error.value = "Could not access camera";
        console.error('Camera error:', err);
      }
    };

    const stopCamera = () => {
      if (video.value?.srcObject) {
        const tracks = video.value.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.value.srcObject = null;
      }
      showCamera.value = false;
    };

    const capturePhoto = () => {
      if (!video.value) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.value.videoWidth;
      canvas.height = video.value.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video.value, 0, 0);
        preview.value = canvas.toDataURL('image/jpeg', 0.8);
        stopCamera();
      }
    };

    onBeforeUnmount(() => {
      stopCamera();
    });

    onMounted(async () => {
      try {
        if (route.params.id) {
          const contact = await contactStore.getContactById(route.params.id);
          avatar.value = contact?.photo;
        }
      } catch (err) {
        error.value = "Failed to fetch contact information";
        console.error('Fetch error:', err);
      }
    });

    const selectFile = () => {
      if (fileInput.value) {
        fileInput.value.click();
      }
    };

    const handleFileChange = (event) => {
      const file = event.target.files?.[0];
      if (file) {
        validateAndPreviewFile(file);
      }
    };

    const handleDrop = (event) => {
      isDragging.value = false;
      const file = event.dataTransfer.files[0];
      if (file) {
        validateAndPreviewFile(file);
      }
    };

    const validateAndPreviewFile = (file) => {
      if (!file) {
        error.value = "No file selected";
        return;
      }

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        error.value = "Only images (JPEG, PNG, GIF) are allowed";
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        error.value = `Image size must not exceed 5MB (current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        preview.value = reader.result;
        error.value = "";
      };
      reader.onerror = () => {
        error.value = "Failed to read file";
      };
      reader.readAsDataURL(file);
    };

    const uploadAvatar = async () => {
      if (!preview.value) return;

      try {
        uploading.value = true;
        error.value = "";

        // Convert base64 to blob
        const response = await fetch(preview.value);
        const blob = await response.blob();

        if (blob.size > MAX_FILE_SIZE) {
          throw new Error(`Image size must not exceed 5MB (current size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);
        }

        // Create FormData
        const formData = new FormData();
        formData.append("photo", blob, "avatar.jpg");

        try {
          // Upload avatar
          await contactStore.updateAvatar(route.params.id, formData);
          router.push("/");
        } catch (err) {
          if (err.response?.status === 413) {
            throw new Error("Image too large. Max size: 5MB");
          }
          throw err;
        }
      } catch (err) {
        error.value = err.message || "Upload failed. Please try a smaller image (max 5MB)";
        console.error('Upload error:', err);
      } finally {
        uploading.value = false;
      }
    };
    return {
      preview,
      avatar,
      uploading,
      error,
      isDragging,
      fileInput,
      selectFile,
      handleFileChange,
      handleDrop,
      uploadAvatar,
      video,
      showCamera,
      isMobile,
      startCamera,
      stopCamera,
      capturePhoto
    };
  }
};
</script>
