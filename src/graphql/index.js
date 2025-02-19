import gql from 'graphql-tag';

export const GET_CONTACTS = gql`
  query GetContacts($pagination: PaginationInput) {
    contacts(pagination: $pagination) {
      contacts {
        id
        name
        phone
        photo
        createdAt
        updatedAt
      }
      page
      limit
      pages
      total
    }
  }
`;

export const CREATE_CONTACT = gql`
  mutation CreateContact($input: ContactInput!) {
    createContact(input: $input) {
      id
      name
      phone
      photo
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($id: ID!, $input: ContactInput!) {
    updateContact(id: $id, input: $input) {
      id
      name
      phone
      photo
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: ID!) {
    deleteContact(id: $id) {
      id
      name
      phone
      photo
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_AVATAR = gql`
  mutation UpdateAvatar($id: ID!, $photo: String!) {
    updateAvatar(id: $id, photo: $photo) {
      id
      photo
      updatedAt
    }
  }
`;
