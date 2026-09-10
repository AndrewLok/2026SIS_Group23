import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Field } from '@/components/common/Field'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/types'

// Both modes carry the same fields so one resolver type covers the form; sign up
// simply asks more of two of them.
const signInSchema = z.object({
  displayName: z.string(),
  email: z.string().min(1, 'Enter your email.').email('That does not look like an email.'),
  password: z.string().min(1, 'Enter your password.'),
})

const signUpSchema = signInSchema.extend({
  displayName: z.string().min(1, 'Enter the name your group will recognise.'),
  password: z.string().min(6, 'Use at least six characters.'),
})

type Mode = 'signIn' | 'signUp'
type FormValues = { displayName: string; email: string; password: string }

export function LoginPage() {
  const [mode, setMode] = React.useState<Mode>('signIn')
  const [formError, setFormError] = React.useState<string | null>(null)
  const [demoPending, setDemoPending] = React.useState(false)
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/trips'

  const form = useForm<FormValues>({
    resolver: zodResolver(mode === 'signIn' ? signInSchema : signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      if (mode === 'signIn') {
        await session.signIn(values.email, values.password)
      } else {
        await session.signUp(values.displayName, values.email, values.password)
      }
      navigate(returnTo, { replace: true })
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not sign in. Try again in a moment.',
      )
    }
  })

  const tryDemo = async () => {
    setFormError(null)
    setDemoPending(true)
    try {
      await session.signInAsDemo()
      navigate('/trips', { replace: true })
    } catch {
      setFormError('The demo trip could not be opened.')
    } finally {
      setDemoPending(false)
    }
  }

  const busy = form.formState.isSubmitting || demoPending

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="instrument-value text-4xl leading-none text-radium">VOYAGER</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            One place for what your group agreed to and who paid for it.
          </p>
        </div>

        <form onSubmit={submit} className="plate flex flex-col gap-5 p-5" noValidate>
          {mode === 'signUp' ? (
            <Field label="Display name" error={form.formState.errors.displayName?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  autoComplete="name"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('displayName')}
                />
              )}
            </Field>
          ) : null}

          <Field label="Email" error={form.formState.errors.email?.message} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...form.register('email')}
              />
            )}
          </Field>

          <Field
            label="Password"
            error={form.formState.errors.password?.message}
            hint={mode === 'signUp' ? 'At least six characters. No email verification here.' : undefined}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...form.register('password')}
              />
            )}
          </Field>

          {formError ? (
            <p role="alert" className="text-sm text-caution">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {form.formState.isSubmitting ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : null}
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="placard text-[0.625rem]">or</span>
            <Separator className="flex-1" />
          </div>

          <Button type="button" variant="outline" onClick={() => void tryDemo()} disabled={busy}>
            {demoPending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : null}
            Try the demo trip
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Opens a seeded trip with five members. Everything in it is made up.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === 'signIn' ? 'No account yet?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="text-radium underline underline-offset-4"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
              setFormError(null)
              form.clearErrors()
            }}
          >
            {mode === 'signIn' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
