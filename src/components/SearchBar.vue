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

const debouncedSearchHandler = (event) => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  searchTimeout.value = setTimeout(() => {
    contactStore.setSearch(searchValue.value);
    emit('update:value', searchValue.value);
  }, 300);
};

// Watch for external changes to search value
watch(() => contactStore.search, (newValue) => {
  if (newValue !== searchValue.value) {
    searchValue.value = newValue;
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

<!-- <style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 8px;
  contain: content;
}

.search-input-container {
  position: relative;
  flex-grow: 1;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  pointer-events: none;
}

.search-input-container input {
  width: 100%;
  padding: 8px 8px 8px 36px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 14px;
}

.sort-button, .add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 4px;
  background-color: #e0e0e0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sort-button:hover, .add-button:hover {
  background-color: #d0d0d0;
}

.add-button {
  background-color: #4caf50;
  color: white;
}

.add-button:hover {
  background-color: #45a049;
}
</style> -->