import { ApiError } from '@/types'
import type { Profile } from '@/types'

type BackendUser = {
    id: string
    firstName: string
    lastName: string
    email: string
}

let currentUser: Profile | null = null

async function post<T>(path: string, body: unknown): Promise<T> {
    let response: Response

    try {
        response = await fetch(`/api/auth/${path}`,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

            } catch {
                throw new ApiError(
                    'invalid',
                    'Cannot reach the backend.'
                )
            }

            if (!response.ok) {
                const error = (await response.json().catch(() => null)) as {
                    message?: string
                } | null

                const code = 
                    response.status === 401
                    ? 'invalid_credentials'
                    : response.status === 409
                      ? 'conflict'
                      : 'invalid'

                throw new ApiError(
                    code,
                    error?.message ?? `Request failed (${response.status}).`,
                )
            }
            return response.json() as Promise<T>
        }

    export async function getSession(): Promise<Profile | null>{
        return currentUser
    }



    export async function signIn(
        email: string,
        password: string,
    ): Promise<Profile> {
        const user = await post<BackendUser>('login', {
            email: email.trim().toLowerCase(),
            password,
        })
        
        currentUser = {
            id: user.id,
            displayName: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            avatarHue: 142,
        }

        return currentUser




        }

    export async function signUp(
        displayName: string,
        email: string,
        password: string,
    ): Promise<Profile> {
        const name = displayName.trim()
        if (!name) {
            throw new ApiError('invalid', 'Enter your name.')
        }
        const [firstName, ...remainingNames] = name.split(/\s+/)

        await post<{ message: string; userId: string}>('register', {
            firstName,
            lastName: remainingNames.join(' '),
            email: email.trim().toLowerCase(),
            password,
        })
        return signIn(email, password)
        }

    export async function signOut(): Promise<void> {
        currentUser = null
    }

    export async function signInAsDemo(): Promise<Profile>{
        throw new ApiError(
            'invalid',
            'Demo login not available'
        )
    }
    