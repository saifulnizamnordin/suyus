import { useEffect, useReducer } from "react"

export type RunnerState = "idle" | "busy" | "offline"

export type Runner = {
  id: number
  state: RunnerState
  job?: string
  remaining: number
}

export type Fleet = {
  runners: Runner[]
  queued: number
  done: number
  running: boolean
  incident: boolean
  history: number[]
}

const TICK_MS = 300
const HISTORY_LEN = 80
const PIPELINE_JOBS = 180
// Runners taken offline by the "simulate incident" button.
const INCIDENT_RUNNERS = [39, 40, 41, 42]

type Action =
  | { type: "start" }
  | { type: "reset" }
  | { type: "tick" }
  | { type: "incident" }
  | { type: "resolve" }

function initial(count: number): Fleet {
  return {
    runners: Array.from({ length: count }, (_, i) => ({ id: i + 1, state: "idle", remaining: 0 })),
    queued: 0,
    done: 0,
    running: false,
    incident: false,
    history: [0],
  }
}

function makeReducer(count: number, jobTypes: string[]) {
  return function reducer(fleet: Fleet, action: Action): Fleet {
    switch (action.type) {
      case "start":
        return { ...fleet, queued: fleet.queued + PIPELINE_JOBS, running: true }
      case "reset":
        return initial(count)
      case "incident": {
        let requeued = 0
        const runners = fleet.runners.map((r) => {
          if (!INCIDENT_RUNNERS.includes(r.id)) return r
          if (r.state === "busy") requeued++
          return { ...r, state: "offline" as const, job: undefined, remaining: 0 }
        })
        return { ...fleet, runners, queued: fleet.queued + requeued, incident: true }
      }
      case "resolve":
        return {
          ...fleet,
          incident: false,
          runners: fleet.runners.map((r) => (r.state === "offline" ? { ...r, state: "idle" as const } : r)),
        }
      case "tick": {
        let { queued, done } = fleet
        const runners = fleet.runners.map((r) => {
          if (r.state === "busy") {
            if (r.remaining > 1) return { ...r, remaining: r.remaining - 1 }
            done++
            r = { ...r, state: "idle", job: undefined, remaining: 0 }
          }
          // Not every idle runner grabs work on the same tick, so the ramp-up looks like real scheduling.
          if (r.state === "idle" && queued > 0 && Math.random() < 0.6) {
            queued--
            return {
              ...r,
              state: "busy" as const,
              job: jobTypes[Math.floor(Math.random() * jobTypes.length)],
              remaining: 4 + Math.floor(Math.random() * 14),
            }
          }
          return r
        })
        const busy = runners.filter((r) => r.state === "busy").length
        const history = [...fleet.history, busy].slice(-HISTORY_LEN)
        const running = queued > 0 || busy > 0
        return { ...fleet, runners, queued, done, running, history }
      }
    }
  }
}

export function useFleetSimulation(count: number, jobTypes: string[]) {
  const [fleet, dispatch] = useReducer(makeReducer(count, jobTypes), count, initial)

  useEffect(() => {
    if (!fleet.running) return
    const id = setInterval(() => dispatch({ type: "tick" }), TICK_MS)
    return () => clearInterval(id)
  }, [fleet.running])

  return {
    fleet,
    start: () => dispatch({ type: "start" }),
    reset: () => dispatch({ type: "reset" }),
    incident: () => dispatch({ type: "incident" }),
    resolve: () => dispatch({ type: "resolve" }),
  }
}
