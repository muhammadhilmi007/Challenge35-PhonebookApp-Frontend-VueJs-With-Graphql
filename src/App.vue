<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script >
import { defineComponent } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'

// Import your pages
import MainPage from '@/views/HomeView.vue';
import AddContact from '@/views/AddView.vue';
import AvatarUpload from '@/components/AvatarUpload.vue';

// Create a Pinia store instance
const pinia = createPinia();

// Set up the router
const routes = [
  { path: '/', component: MainPage },
  { path: '/add', component: AddContact },
  { path: '/avatar/:id', component: AvatarUpload }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default defineComponent({
  setup() {
    return { pinia, router };
  }
});
</script>
