/*
 * Foundation shell. Renders the direction contract's FIRST VIEWPORT against the
 * instrument token layer, so the panel, the type axes and the signal colours are
 * verifiable before the data layer exists. Content here is seeded and synthetic.
 * Step 5 replaces this with the routed TripOverview reading live data.
 */

type Instrument = {
  label: string
  value: string
  unit?: string
  state?: 'normal' | 'caution'
}

const instruments: Instrument[] = [
  { label: 'Members', value: '5' },
  { label: 'Voting', value: '3', unit: 'open' },
  { label: 'Calendar', value: '8', unit: 'agreed' },
  { label: 'Expenses', value: '42.50', unit: 'owing', state: 'caution' },
  { label: 'Fuel', value: '3', unit: 'legs' },
  { label: 'Chat', value: '12', unit: 'unread' },
]

function InstrumentPlate({ label, value, unit, state = 'normal' }: Instrument) {
  const tone = state === 'caution' ? 'text-caution' : 'text-radium'
  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-face p-5 shadow-[var(--shadow-panel)]">
      <div className="flex size-24 items-center justify-center rounded-full border border-bezel-edge bg-panel shadow-[var(--shadow-recessed)]">
        <span className={`instrument-value text-4xl leading-none ${tone}`}>{value}</span>
      </div>
      <div className="flex w-full items-baseline justify-center gap-1.5 rounded-sm border border-bezel px-2 py-1">
        <span className="placard text-[0.6875rem] leading-none">{label}</span>
        {unit ? <span className="placard text-[0.6875rem] leading-none opacity-70">{unit}</span> : null}
      </div>
    </div>
  )
}

function ReadingStrip({
  label,
  value,
  detail,
  state = 'normal',
}: {
  label: string
  value: string
  detail: string
  state?: 'normal' | 'caution'
}) {
  const tone = state === 'caution' ? 'text-caution' : 'text-radium'
  return (
    <div className="rounded-md bg-face px-5 py-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="placard text-xs">{label}</span>
        <span className={`instrument-value text-2xl leading-none ${tone}`}>{value}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh bg-panel">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-bezel pb-5">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Great Ocean Road 2027</h1>
          <p className="flex items-baseline gap-2">
            <span className="placard text-xs">Departs in</span>
            <span className="tabular text-xl text-radium">18</span>
            <span className="placard text-xs">days</span>
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <ReadingStrip
            label="Next movement"
            value="09:40"
            detail="Twelve Apostles walk, agreed by 4 of 5 members."
          />
          <ReadingStrip
            label="Your balance"
            value="$42.50"
            detail="You owe Priya $42.50. Even split across 5 members."
            state="caution"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {instruments.map((item) => (
            <InstrumentPlate key={item.label} {...item} />
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Foundation shell. Every figure above is seeded demo data, not real activity.
        </p>
      </main>
    </div>
  )
}
