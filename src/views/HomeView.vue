<template>
  <div class="app">
    <SearchBar
      :value="search"
      @update:value="handleSearchChange"
      @add="navigateToAdd"
    />
    <ContactList />
  </div>
</template>

<script>
import { ref, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '../stores/contacts';
import ContactList from "@/components/ContactList.vue";
import SearchBar from "@/components/SearchBar.vue";

export default {
  components: { SearchBar, ContactList },
  setup() {
    const router = useRouter();
    const contactStore = useContactStore();
    const search = ref('');

    const handleSearchChange = (value) => {
      try {
        search.value = value;
        contactStore.setSearch(value); // Changed from setSearchTerm to setSearch
      } catch (error) {
        console.error('Search change error:', error);
      }
    };

    const navigateToAdd = () => {
      router.push('/add');
    };

    // Initialize contacts with error handling
    onMounted(async () => {
      try {
        if (navigator.onLine) {
          // If online, fetch fresh data and save to sessionStorage
          await contactStore.resetAndFetchContacts();
        } else {
          // If offline, load from sessionStorage
          await contactStore.fetchContacts();
        }
      } catch (error) {
        console.error('Error initializing contacts:', error);
      }
    });

    // Refresh contacts when component is activated (when returning from other routes)
    onActivated(async () => {
      try {
        await contactStore.fetchContacts();
      } catch (error) {
        console.error('Error refreshing contacts:', error);
      }
    });

    return {
      search,
      handleSearchChange,
      navigateToAdd
    };
  }
};
</script>


