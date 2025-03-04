<template>
  <div class="search-bar">
    <button 
      @click="handleSortClick" 
      class="sort-button"
      :aria-label="`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`"
    >
      <FontAwesomeIcon :icon="sortOrder === 'asc' ? icons.sortDown : icons.sortUp" />
    </button>

    <div class="search-input-container">
      <FontAwesomeIcon :icon="icons.search" class="search-icon" />
      <input
        type="text"
        placeholder="Search by name or phone..."
        v-model="searchValue"
        @input="debouncedSearchHandler"
        aria-label="Search contacts"
      />
    </div>

    <button 
      class="add-button" 
      @click="$emit('add')"
      aria-label="Add new contact"
    >
      <FontAwesomeIcon :icon="icons.userPlus" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, shallowRef } from 'vue';
import { useContactStore } from '../stores/contacts';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSearch, faUserPlus, faSortAlphaDown, faSortAlphaUp } from '@fortawesome/free-solid-svg-icons';
import { debounce } from 'lodash';

const props = defineProps({
  value: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:value', 'add']);
const contactStore = useContactStore();
const sortOrder = shallowRef(contactStore.sortOrder);
const searchTimeout = shallowRef(null);
const searchValue = ref(props.value || contactStore.search || '');

// Use shallowRef for objects that don't need reactivity internally
const icons = shallowRef({
  search: faSearch,
  userPlus: faUserPlus,
  sortDown: faSortAlphaDown,
  sortUp: faSortAlphaUp
});

const handleSortClick = () => {
  const newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
  sortOrder.value = newSortOrder;
  contactStore.setSort('name', newSortOrder);
};

const debouncedEmit = debounce((value) => {
  contactStore.setSearch(value);
  emit('update:value', value);
}, 300, { 
  leading: false, 
  trailing: true 
});

const debouncedSearchHandler = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
    searchTimeout.value = null;
  }
  
  // Reset page when searching
  contactStore.currentPage = 1;
  debouncedEmit(searchValue.value);
};

// Watch for external changes to search value
watch(() => contactStore.search, (newValue) => {
  if (newValue !== searchValue.value) {
    searchValue.value = newValue;
    contactStore.resetAndFetchContacts();
  }
});

// Watch for prop changes
watch(() => props.value, (newValue) => {
  if (newValue !== searchValue.value) {
    searchValue.value = newValue;
  }
});

// Watch for store sort order changes
watch(() => contactStore.sortOrder, (newValue) => {
  sortOrder.value = newValue;
});

onMounted(() => {
  // Ensure initial values are in sync
  if (contactStore.search && contactStore.search !== searchValue.value) {
    searchValue.value = contactStore.search;
    emit('update:value', searchValue.value);
  }
});

onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>