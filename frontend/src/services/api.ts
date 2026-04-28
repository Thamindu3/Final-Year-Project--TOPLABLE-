import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Product API
export const productAPI = {
  getAll: () => api.get('/api/products/'),
  getById: (id: number) => api.get(`/api/products/${id}`),
  getByCategory: (category: string) => api.get(`/api/products/category/${category}`),
};

// Virtual Try-On API
export const tryonAPI = {
  uploadImages: (personImage: File, clothImage: File) => {
    const formData = new FormData();
    formData.append('person_image', personImage);
    formData.append('cloth_image', clothImage);
    
    return api.post('/api/tryon/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Recommendations API
export const recommendationAPI = {
  getRecommendations: (productId: number, limit: number = 5) => 
    api.get(`/api/recommendations/${productId}?limit=${limit}`),
};