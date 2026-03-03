import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { RESTAURANT_ID } from '../services/api'

export default function useSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)

    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL, {
            auth: { restaurant_id: RESTAURANT_ID },
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
    }, [])

    return { socket: socketRef.current, isConnected }
}
