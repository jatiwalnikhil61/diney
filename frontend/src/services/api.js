import axios from 'axios'

// API calls use relative URLs so they go through the Vite proxy in dev
const api = axios.create({
    baseURL: '',
})

export default api
export const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID
