import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// Axios instance for most API calls
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Product API - Using fetch to properly handle response structure
export const productAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    const data = await response.json();
    return data.products; // Return the products array from {success, count, products}
  },
  
  getById: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
    if (!response.ok) throw new Error('Failed to fetch product');
    const data = await response.json();
    return data.product; // Return the product object from {success, product}
  },
  
  getByCategory: async (category: string) => {
    const response = await fetch(`${API_BASE_URL}/api/products/category/${category}`);
    if (!response.ok) throw new Error('Failed to fetch products by category');
    const data = await response.json();
    return data.products; // Return the products array
  },
};

// Virtual Try-On API
export const tryonAPI = {
  uploadPerson: async (personImage: File) => {
    const formData = new FormData();
    formData.append('file', personImage);
    
    const response = await fetch(`${API_BASE_URL}/upload/person`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Failed to upload person image');
    return response.json();
  },
  
  uploadCloth: async (clothImage: File) => {
    const formData = new FormData();
    formData.append('file', clothImage);
    
    const response = await fetch(`${API_BASE_URL}/upload/cloth`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Failed to upload cloth image');
    return response.json();
  },
  
  generateMask: async () => {
    const response = await fetch(`${API_BASE_URL}/preprocess/cloth-mask`, {
      method: 'POST',
    });
    
    if (!response.ok) throw new Error('Failed to generate cloth mask');
    return response.json();
  },
  
  runTryon: async (personName: string = 'custom_person_00.jpg') => {
    const response = await fetch(`${API_BASE_URL}/run?person_name=${personName}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to run virtual try-on');
    }
    return response.json();
  },
  
  getResultImage: (jobName: string, filename: string) => {
    return `${API_BASE_URL}/result/${jobName}/${filename}`;
  },
};

// Recommendations API (placeholder - not implemented in backend yet)
export const recommendationAPI = {
  getRecommendations: (productId: number, limit: number = 5) => 
    api.get(`/api/recommendations/${productId}?limit=${limit}`),
};

// Helper to get person images list
export const personsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/persons`);
    if (!response.ok) throw new Error('Failed to fetch persons');
    const data = await response.json();
    return data.persons; // Return persons array
  },
};
