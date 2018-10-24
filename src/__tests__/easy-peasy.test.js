/* eslint-disable no-param-reassign */

import { createStore, effect } from '../index'

const resolveAfter = (data, ms) =>
  new Promise(resolve => setTimeout(() => resolve(data), ms))

beforeEach(() => {
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = undefined
})

const trackActionsMiddleware = () => {
  const middleware = () => next => action => {
    middleware.actions.push(action)
    return next(action)
  }
  middleware.actions = []
  return middleware
}

test('empty object in state', () => {
  // arrange
  const model = {
    todos: {
      items: {},
      foo: [],
    },
    bar: null,
  }

  // act
  const store = createStore(model)

  // assert
  expect(store.getState()).toEqual({
    todos: {
      items: {},
      foo: [],
    },
    bar: null,
  })
})

test('basic features', () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      login: (state, user) => {
        state.user = user
      },
    },
  }

  // act
  const store = createStore(model)

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: undefined,
    },
  })

  // act
  store.dispatch.session.login({
    name: 'bob',
  })

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: {
        name: 'bob',
      },
    },
  })
})

test('nested action', () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      settings: {
        favouriteColor: 'red',
        setFavouriteColor: (state, color) => {
          state.favouriteColor = color
        },
      },
      login: () => undefined,
    },
  }

  // act
  const store = createStore(model)

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: undefined,
      settings: {
        favouriteColor: 'red',
      },
    },
  })

  // act
  store.dispatch.session.settings.setFavouriteColor('blue')

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: undefined,
      settings: {
        favouriteColor: 'blue',
      },
    },
  })
})

test('redux thunk configured', async () => {
  // arrange
  const model = { foo: 'bar' }
  const store = createStore(model)
  const action = payload => () => Promise.resolve(payload)

  // act
  const result = await store.dispatch(action('foo'))

  // assert
  expect(result).toBe('foo')
})

test('async action', async () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      loginSucceeded: (state, payload) => {
        state.user = payload
      },
      login: effect(async (dispatch, payload) => {
        expect(payload).toEqual({
          username: 'bob',
          password: 'foo',
        })
        const user = await resolveAfter({ name: 'bob' }, 15)
        dispatch.session.loginSucceeded(user)
        return 'resolved'
      }),
    },
  }

  // act
  const store = createStore(model)

  // act
  const result = await store.dispatch.session.login({
    username: 'bob',
    password: 'foo',
  })

  // assert
  expect(result).toBe('resolved')
  expect(store.getState()).toEqual({
    session: {
      user: {
        name: 'bob',
      },
    },
  })
})

test('async action is always promise chainable', done => {
  // arrange
  const model = { doSomething: effect(() => undefined) }
  const store = createStore(model)

  // act
  store.dispatch.doSomething().then(done)
})

test('dispatch another branch action', async () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      login: effect(dispatch => {
        dispatch.stats.incrementLoginAttempts()
      }),
    },
    stats: {
      loginAttempts: 0,
      incrementLoginAttempts: state => {
        state.loginAttempts += 1
      },
    },
  }

  // act
  const store = createStore(model)

  // act
  await store.dispatch.session.login()

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: undefined,
    },
    stats: {
      loginAttempts: 1,
    },
  })
})

test('state with no actions', () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      login: (state, user) => {
        state.user = user
      },
    },
    // No associated actions here
    todos: {
      foo: [],
    },
  }

  // act
  const store = createStore(model)

  // act
  store.dispatch.session.login({
    name: 'bob',
  })

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: {
        name: 'bob',
      },
    },
    todos: {
      foo: [],
    },
  })
})

test('redux dev tools disabled', () => {
  // arrange
  const model = { foo: 'bar' }
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = jest.fn()

  // act
  createStore(model, {
    devTools: false,
  })

  // assert
  expect(window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__).not.toHaveBeenCalled()
})

test('redux dev tools enabled by default', () => {
  // arrange
  const model = { foo: 'bar' }
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = jest.fn()

  // act
  createStore(model)

  // assert
  expect(window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__).toHaveBeenCalledTimes(1)
})

test('allows custom middleware', done => {
  // arrange
  const customMiddleware = () => next => action => {
    // assert
    expect(action.type).toBe('logFullState')
    next(action)
    done()
  }

  // act
  const store = createStore({}, { middleware: [customMiddleware] })
  store.dispatch.logFullState()
})

test('supports initial state', () => {
  // arrange
  const model = {
    foo: {
      bar: {
        stuff: [1, 2],
      },
      color: 'red',
    },
    baz: 'bob',
  }
  const initialState = {
    foo: {
      bar: {
        stuff: [3, 4],
        invalid: 'qux',
      },
    },
  }

  // act
  const store = createStore(model, { initialState })

  // assert
  expect(store.getState()).toEqual({
    foo: {
      bar: {
        stuff: [3, 4],
      },
      color: 'red',
    },
    baz: 'bob',
  })
})

test('dispatches an action to represent the start of an effect', () => {
  // arrange
  const model = {
    foo: {
      doSomething: effect(() => undefined),
    },
  }
  const trackActions = trackActionsMiddleware()
  const store = createStore(model, { middleware: [trackActions] })
  const payload = 'hello'

  // act
  store.dispatch.foo.doSomething(payload)

  // assert
  expect(trackActions.actions).toEqual([{ type: 'foo.doSomething', payload }])
})
