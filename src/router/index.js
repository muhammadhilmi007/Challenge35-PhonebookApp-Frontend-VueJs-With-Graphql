import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MainPage from '@/views/HomeView.vue';
import AddContact from '@/views/AddView.vue';
import AvatarUpload from '@/components/AvatarUpload.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: MainPage
  },
  {
    path: '/add',
    name: 'add',
    component: AddContact
  },
  {
    path: '/avatar/:id',
    name: 'avatar',
    component: AvatarUpload,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});


export default router
