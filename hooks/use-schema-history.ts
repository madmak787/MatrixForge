'use client'

import { useCallback, useReducer } from 'react'
import { Table } from '@/lib/types'

const MAX_HISTORY = 100
// Edits with the same merge key this close together (typing a name) become one undo step
const MERGE_WINDOW_MS = 1200

type Updater = (tables: Table[]) => Table[]

interface State {
  tables: Table[]
  past: Table[][]
  future: Table[][]
  gestureBase: Table[] | null
  mergeKey: string | null
  mergeAt: number
  /** Bumped on reset so consumers can tell loads apart from edits */
  version: number
}

type Action =
  | { type: 'reset'; tables: Table[] }
  | { type: 'commit'; update: Updater; mergeKey?: string; at: number }
  | { type: 'begin' }
  | { type: 'preview'; update: Updater }
  | { type: 'end' }
  | { type: 'undo' }
  | { type: 'redo' }

function pushPast(past: Table[][], tables: Table[]) {
  const next = [...past, tables]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { tables: action.tables, past: [], future: [], gestureBase: null, mergeKey: null, mergeAt: 0, version: state.version + 1 }
    case 'commit': {
      const tables = action.update(state.tables)
      if (tables === state.tables) return state
      const merge = !!action.mergeKey && action.mergeKey === state.mergeKey && action.at - state.mergeAt < MERGE_WINDOW_MS
      return {
        ...state,
        tables,
        past: merge ? state.past : pushPast(state.past, state.tables),
        future: [],
        mergeKey: action.mergeKey || null,
        mergeAt: action.at,
      }
    }
    case 'begin':
      return { ...state, gestureBase: state.tables }
    case 'preview': {
      const tables = action.update(state.tables)
      return tables === state.tables ? state : { ...state, tables }
    }
    case 'end': {
      const base = state.gestureBase
      if (!base) return state
      if (base === state.tables) return { ...state, gestureBase: null }
      return { ...state, gestureBase: null, past: pushPast(state.past, base), future: [], mergeKey: null }
    }
    case 'undo': {
      if (state.past.length === 0) return state
      return {
        ...state,
        tables: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.tables, ...state.future],
        mergeKey: null,
      }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      return {
        ...state,
        tables: state.future[0],
        past: pushPast(state.past, state.tables),
        future: state.future.slice(1),
        mergeKey: null,
      }
    }
  }
}

export function useSchemaHistory() {
  const [state, dispatch] = useReducer(reducer, {
    tables: [],
    past: [],
    future: [],
    gestureBase: null,
    mergeKey: null,
    mergeAt: 0,
    version: 0,
  })

  return {
    tables: state.tables,
    version: state.version,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset: useCallback((tables: Table[]) => dispatch({ type: 'reset', tables }), []),
    commit: useCallback(
      (update: Updater, mergeKey?: string) => dispatch({ type: 'commit', update, mergeKey, at: Date.now() }),
      [],
    ),
    /** Start a continuous gesture (dragging); previews inside it become one undo step on end() */
    begin: useCallback(() => dispatch({ type: 'begin' }), []),
    preview: useCallback((update: Updater) => dispatch({ type: 'preview', update }), []),
    end: useCallback(() => dispatch({ type: 'end' }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
  }
}
