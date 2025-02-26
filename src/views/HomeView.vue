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
      search.value = value;
      contactStore.setSearchTerm(value);
    };

    const navigateToAdd = () => {
      router.push('/add');
    };

    // Refresh contacts when component is mounted
    onMounted(() => {
      contactStore.resetAndFetchContacts();
    });

    // Refresh contacts when component is activated (when returning from other routes)
    onActivated(() => {
      contactStore.resetAndFetchContacts();
    });

    return {
      search,
      handleSearchChange,
      navigateToAdd
    };
  }
};
</script>


