import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

export default function useSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [socket, setSocket] = useState(null)
    const { effectiveRestaurantId } = useAuth()

    useEffect(() => {
        const s = io(import.meta.env.VITE_API_URL, {
            auth: {
                restaurant_id: effectiveRestaurantId,
            },
            transports: ['websocket', 'polling'],
        })

        s.on('connect', () => {
            console.log('Socket connected:', s.id)
            setIsConnected(true)
        })

        s.on('disconnect', () => {
            console.log('Socket disconnected')
            setIsConnected(false)
        })

        setSocket(s)

        return () => {
            s.disconnect()
            setSocket(null)
        }
    }, [effectiveRestaurantId])

    return { socket, isConnected }
}
