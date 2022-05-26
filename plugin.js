//  @vue/devtools-api'  -->  the public devtools API that can be installed in Vue plugins. Using the API, you can show information to the user and improve the app debugging experience. This package lets us register a new Vue Devtools Plugin from our code and comes with full TypeScript typings.
    // install package via yarn add @vue/devtools-api
import {
  setupDevtoolsPlugin,
  TimelineEvent,
  App as DevtoolsApp,
} from '@vue/devtools-api'


import { ComponentPublicInstance, markRaw, toRaw, unref, watch } from 'vue-demi'

// what VUEX imported: 
// import { setupDevtoolsPlugin } from '@vue/devtools-api'
// import { makeLocalGetters } from '../store-util'

// STARTS INTERNAL IMPORTING OF PINIA FUNCTIONALITY: we will need to change this based on our functionality/business logic.
import { Pinia, PiniaPluginContext } from '../rootStore'
// edit
import {
  _GettersTree,
  MutationType,
  StateTree,
  _ActionsTree,
  StoreGeneric,
} from '../types'
// edit
import {
  actionGlobalCopyState,
  actionGlobalPasteState,
  actionGlobalSaveState,
  actionGlobalOpenStateFile,
} from './actions'
// edit
import {
  formatDisplay,
  formatEventData,
  formatMutationType,
  formatStoreForInspectorState,
  formatStoreForInspectorTree,
  PINIA_ROOT_ID,
  PINIA_ROOT_LABEL,
} from './formatting'
// edit
import { isPinia, toastMessage } from './utils'

// timeline can be paused when directly changing the state
let isTimelineActive = true
const componentStateTypes: string[] = []

const MUTATIONS_LAYER_ID = 'pinia:mutations'
const INSPECTOR_ID = 'pinia'

/**
 * Gets the displayed name of a store in devtools
 *
 * @param id - id of the store
 * @returns a formatted string
 */
const getStoreType = (id: string) => '🍍 ' + id

/**
 * Add the pinia plugin without any store. Allows displaying a Pinia plugin tab
 * as soon as it is added to the application.
 *
 * @param app - Vue application
 * @param pinia - pinia instance
 */

// Then we export a function to setup our Vue Devtools plugin:
// format from plugin guide: export function setupDevtools (app) {...
export function registerPiniaDevtools(app: DevtoolsApp, pinia: Pinia) {
  setupDevtoolsPlugin(
      // Add plugin options in the first argument:
      { 
      id: 'dev.esm.pinia',
      label: 'Pinia 🍍',
      logo: 'https://pinia.vuejs.org/logo.svg',
      packageName: 'point of vue,
      homepage: 'https://pinia.vuejs.org',
          componentStateTypes,
    //   Every plugin is bound to a Vue application. You need to pass the user application to setupDevtoolsPlugin - the same that your plugin install method gets as the first argument.
      app,
      },
    //   The second argument of setupDevtoolsPlugin is a callback which will get the Vue Devtools API as the first argument:
    (api) => {
      if (typeof api.now !== 'function') {
        toastMessage(
          'You seem to be using an outdated version of Vue Devtools. Are you still using the Beta release instead of the stable one? You can find the links at https://devtools.vuejs.org/guide/installation.html.'
        )
      }
 //   2 of 2 main API category: Timeline: you us to add custom layers and send events.
      api.addTimelineLayer({
        id: MUTATIONS_LAYER_ID,
        label: `Pinia 🍍`,
        color: 0xe5df88,
      })

        // 1 of 2 main API category: components Inspector: allows our plugin to add more information to the component tree and state.
      api.addInspector({
        id: INSPECTOR_ID,
        label: 'Pinia 🍍',
        icon: 'storage',
        treeFilterPlaceholder: 'Search stores',
        actions: [
          {
            icon: 'content_copy',
            action: () => {
              actionGlobalCopyState(pinia)
            },
            tooltip: 'Serialize and copy the state',
          },
          {
            icon: 'content_paste',
            action: async () => {
              await actionGlobalPasteState(pinia)
              api.sendInspectorTree(INSPECTOR_ID)
              api.sendInspectorState(INSPECTOR_ID)
            },
            tooltip: 'Replace the state with the content of your clipboard',
          },
          {
            icon: 'save',
            action: () => {
              actionGlobalSaveState(pinia)
            },
            tooltip: 'Save the state as a JSON file',
          },
          {
            icon: 'folder_open',
            action: async () => {
              await actionGlobalOpenStateFile(pinia)
              api.sendInspectorTree(INSPECTOR_ID)
              api.sendInspectorState(INSPECTOR_ID)
            },
            tooltip: 'Import the state from a JSON file',
          },
        ],
      })

      api.on.inspectComponent((payload, ctx) => {
        const proxy = (payload.componentInstance &&
          payload.componentInstance.proxy) as
          | ComponentPublicInstance
          | undefined
        if (proxy && proxy._pStores) {
          const piniaStores = (
            payload.componentInstance.proxy as ComponentPublicInstance
          )._pStores!

          Object.values(piniaStores).forEach((store) => {
            payload.instanceData.state.push({
              type: getStoreType(store.$id),
              key: 'state',
              editable: true,
              value: store._isOptionsAPI
                ? {
                    _custom: {
                      value: store.$state,
                      actions: [
                        {
                          icon: 'restore',
                          tooltip: 'Reset the state of this store',
                          action: () => store.$reset(),
                        },
                      ],
                    },
                  }
                : store.$state,
            })

            if (store._getters && store._getters.length) {
              payload.instanceData.state.push({
                type: getStoreType(store.$id),
                key: 'getters',
                editable: false,
                value: store._getters.reduce((getters, key) => {
                  try {
                    getters[key] = store[key]
                  } catch (error) {
                    // @ts-expect-error: we just want to show it in devtools
                    getters[key] = error
                  }
                  return getters
                }, {} as _GettersTree<StateTree>),
              })
            }
          })
        }
      })
// You can listen for changes made to the settings by the user with the api.on.setPluginSettings hook:
      api.on.getInspectorTree((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          let stores: Array<StoreGeneric | Pinia> = [pinia]
          stores = stores.concat(Array.from(pinia._s.values()))

          payload.rootNodes = (
            payload.filter
              ? stores.filter((store) =>
                  '$id' in store
                    ? store.$id
                        .toLowerCase()
                        .includes(payload.filter.toLowerCase())
                    : PINIA_ROOT_LABEL.toLowerCase().includes(
                        payload.filter.toLowerCase()
                      )
                )
              : stores
          ).map(formatStoreForInspectorTree)
        }
      })

      api.on.getInspectorState((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const inspectedStore =
            payload.nodeId === PINIA_ROOT_ID
              ? pinia
              : pinia._s.get(payload.nodeId)

          if (!inspectedStore) {
            // this could be the selected store restored for a different project
            // so it's better not to say anything here
            return
          }

          if (inspectedStore) {
            payload.state = formatStoreForInspectorState(inspectedStore)
          }
        }
      })

      api.on.editInspectorState((payload, ctx) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const inspectedStore =
            payload.nodeId === PINIA_ROOT_ID
              ? pinia
              : pinia._s.get(payload.nodeId)

          if (!inspectedStore) {
            return toastMessage(`store "${payload.nodeId}" not found`, 'error')
          }

          const { path } = payload

          if (!isPinia(inspectedStore)) {
            // access only the state
            if (
              path.length !== 1 ||
              !inspectedStore._customProperties.has(path[0]) ||
              path[0] in inspectedStore.$state
            ) {
              path.unshift('$state')
            }
          } else {
            // Root access, we can omit the `.value` because the devtools API does it for us
            path.unshift('state')
          }
          isTimelineActive = false
          payload.set(inspectedStore, path, payload.state.value)
          isTimelineActive = true
        }
      })

      api.on.editComponentState((payload) => {
        if (payload.type.startsWith('🍍')) {
          const storeId = payload.type.replace(/^🍍\s*/, '')
          const store = pinia._s.get(storeId)

          if (!store) {
            return toastMessage(`store "${storeId}" not found`, 'error')
          }

          const { path } = payload
          if (path[0] !== 'state') {
            return toastMessage(
              `Invalid path for store "${storeId}":\n${path}\nOnly state can be modified.`
            )
          }

          // rewrite the first entry to be able to directly set the state as
          // well as any other path
          path[0] = '$state'
          isTimelineActive = false
          payload.set(store, path, payload.state.value)
          isTimelineActive = true
        }
      })
    }
  )
}

function addStoreToDevtools(app: DevtoolsApp, store: StoreGeneric) {
  if (!componentStateTypes.includes(getStoreType(store.$id))) {
    componentStateTypes.push(getStoreType(store.$id))
  }
  // We are going to import setupDevtoolsPlugin from the @vue/devtools-api package:
    // We can now import and use our setupDevtools function in our Vue plugin:
  setupDevtoolsPlugin(
    {
      id: 'dev.esm.pinia',
      label: 'Pinia 🍍',
      logo: 'https://pinia.vuejs.org/logo.svg',
      packageName: 'pinia',
      homepage: 'https://pinia.vuejs.org',
      componentStateTypes,
          app,
          // With the settings option, your plugin can expose some settings to the user. This can be very useful to allow some customization!
      settings: {
          logStoreChanges: {
            //a string to describe the settings item
              label: 'Notify about new/deleted stores',
            // setting types: 
            //boolean
            // text
            // choice
            // options: list of objects with type { value: any, label: string }
            // component: (optional) can be either 'select' (default) or 'button-group'
          type: 'boolean',
          defaultValue: true,
        },
      },
    },
    (api) => {
      // gracefully handle errors
      const now = typeof api.now === 'function' ? api.now.bind(api) : Date.now

      store.$onAction(({ after, onError, name, args }) => {
        const groupId = runningActionId++

          
          //
        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: {
            time: now(),
            title: '🛫 ' + name,
            subtitle: 'start',
            data: {
              store: formatDisplay(store.$id),
              action: formatDisplay(name),
              args,
            },
            groupId,
          },
        })

        after((result) => {
          activeAction = undefined
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now(),
              title: '🛬 ' + name,
              subtitle: 'end',
              data: {
                store: formatDisplay(store.$id),
                action: formatDisplay(name),
                args,
                result,
              },
              groupId,
            },
          })
        })

        onError((error) => {
          activeAction = undefined
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now(),
              logType: 'error',
              title: '💥 ' + name,
              subtitle: 'end',
              data: {
                store: formatDisplay(store.$id),
                action: formatDisplay(name),
                args,
                error,
              },
              groupId,
            },
          })
        })
      }, true)

      store._customProperties.forEach((name) => {
        watch(
          () => unref(store[name]),
          (newValue, oldValue) => {
            api.notifyComponentUpdate()
            api.sendInspectorState(INSPECTOR_ID)
            if (isTimelineActive) {
              api.addTimelineEvent({
                layerId: MUTATIONS_LAYER_ID,
                event: {
                  time: now(),
                  title: 'Change',
                  subtitle: name,
                  data: {
                    newValue,
                    oldValue,
                  },
                  groupId: activeAction,
                },
              })
            }
          },
          { deep: true }
        )
      })

      store.$subscribe(
        ({ events, type }, state) => {
          api.notifyComponentUpdate()
          api.sendInspectorState(INSPECTOR_ID)

          if (!isTimelineActive) return
          // rootStore.state[store.id] = state

          const eventData: TimelineEvent = {
            time: now(),
            title: formatMutationType(type),
            data: {
              store: formatDisplay(store.$id),
              ...formatEventData(events),
            },
            groupId: activeAction,
          }

          // reset for the next mutation
          activeAction = undefined

          if (type === MutationType.patchFunction) {
            eventData.subtitle = '⤵️'
          } else if (type === MutationType.patchObject) {
            eventData.subtitle = '🧩'
          } else if (events && !Array.isArray(events)) {
            eventData.subtitle = events.type
          }

          if (events) {
            eventData.data['rawEvent(s)'] = {
              _custom: {
                display: 'DebuggerEvent',
                type: 'object',
                tooltip: 'raw DebuggerEvent[]',
                value: events,
              },
            }
          }

          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: eventData,
          })
        },
        { detached: true, flush: 'sync' }
      )

      const hotUpdate = store._hotUpdate
      store._hotUpdate = markRaw((newStore) => {
        hotUpdate(newStore)
        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: {
            time: now(),
            title: '🔥 ' + store.$id,
            subtitle: 'HMR update',
            data: {
              store: formatDisplay(store.$id),
              info: formatDisplay(`HMR update`),
            },
          },
        })
        // update the devtools too
        api.notifyComponentUpdate()
        api.sendInspectorTree(INSPECTOR_ID)
        api.sendInspectorState(INSPECTOR_ID)
      })

      const { $dispose } = store
      store.$dispose = () => {
        $dispose()
        api.notifyComponentUpdate()
        api.sendInspectorTree(INSPECTOR_ID)
        api.sendInspectorState(INSPECTOR_ID)
        api.getSettings().logStoreChanges &&
          toastMessage(`Disposed "${store.$id}" store 🗑`)
      }

      // trigger an update so it can display new registered stores
      api.notifyComponentUpdate()
      api.sendInspectorTree(INSPECTOR_ID)
      api.sendInspectorState(INSPECTOR_ID)
      api.getSettings().logStoreChanges &&
        toastMessage(`"${store.$id}" store installed 🆕`)
    }
  )
}

let runningActionId = 0
let activeAction: number | undefined

/**
 * Patches a store to enable action grouping in devtools by wrapping the store with a Proxy that is passed as the
 * context of all actions, allowing us to set `runningAction` on each access and effectively associating any state
 * mutation to the action.
 *
 * @param store - store to patch
 * @param actionNames - list of actionst to patch
 */
function patchActionForGrouping(store: StoreGeneric, actionNames: string[]) {
  // original actions of the store as they are given by pinia. We are going to override them
  const actions = actionNames.reduce((storeActions, actionName) => {
    // use toRaw to avoid tracking #541
    storeActions[actionName] = toRaw(store)[actionName]
    return storeActions
  }, {} as _ActionsTree)

  for (const actionName in actions) {
    store[actionName] = function () {
      // setActivePinia(store._p)
      // the running action id is incremented in a before action hook
      const _actionId = runningActionId
      const trackedStore = new Proxy(store, {
        get(...args) {
          activeAction = _actionId
          return Reflect.get(...args)
        },
        set(...args) {
          activeAction = _actionId
          return Reflect.set(...args)
        },
      })
      return actions[actionName].apply(
        trackedStore,
        arguments as unknown as any[]
      )
    }
  }
}

/**
 * pinia.use(devtoolsPlugin)
 */
export function devtoolsPlugin<
  Id extends string = string,
  S extends StateTree = StateTree,
  G /* extends GettersTree<S> */ = _GettersTree<S>,
  A /* extends ActionsTree */ = _ActionsTree
>({ app, store, options }: PiniaPluginContext<Id, S, G, A>) {
  // HMR module
  if (store.$id.startsWith('__hot:')) {
    return
  }

  // detect option api vs setup api
  if (options.state) {
    store._isOptionsAPI = true
  }

  // only wrap actions in option-defined stores as this technique relies on
  // wrapping the context of the action with a proxy
  if (typeof options.state === 'function') {
    patchActionForGrouping(
      // @ts-expect-error: can cast the store...
      store,
      Object.keys(options.actions)
    )

    const originalHotUpdate = store._hotUpdate

    // Upgrade the HMR to also update the new actions
    toRaw(store)._hotUpdate = function (newStore) {
      originalHotUpdate.apply(this, arguments as any)
      patchActionForGrouping(
        store as StoreGeneric,
        Object.keys(newStore._hmrPayload.actions)
      )
    }
  }

  addStoreToDevtools(
    app,
    // FIXME: is there a way to allow the assignment from Store<Id, S, G, A> to StoreGeneric?
    store as StoreGeneric
  )
}
