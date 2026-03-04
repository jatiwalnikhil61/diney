import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

export default function useSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)
    const { token, effectiveRestaurantId } = useAuth()

    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL, {
            auth: {
                token,
                restaurant_id: effectiveRestaurantId,
            },
            transports: ['websocket', 'polling'],
        })

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id)
            setIsConnected(true)
        })

        socket.on('disconnect', () => {
            console.log('Socket disconnected')
            setIsConnected(false)
        })

        socketRef.current = socket

        return () => {
            socket.disconnect()
        }
    }, [token, effectiveRestaurantId])

    return { socket: socketRef.current, isConnected }
}
