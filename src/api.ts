import axios from 'axios';

const api = axios.create({
  withCredentials: true, // Required for cookies (session)
});

export default api;

