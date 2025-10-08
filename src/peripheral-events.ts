import { getLogger } from './logging';
import { WPKEventListenerRemover, WPKKeyEventInfo, WPKMouseButton, WPKMouseButtonEventInfo, WPKMouseDragEventInfo, WPKMouseMoveEventInfo, WPKPeripheralEventHandler, WPKPeripheralEventHandlers, WPKPeripheralEventInfoTypeMap, WPKPeripheralEventType, WPKScreenEventInfo, WPKScreenXY } from './types';
import { changeDetectorFactory, logFuncs, WPKChangeDetector } from './utils';

const LOGGER = getLogger('events');

type WPKCoords = [number, number];

export const addPeripheralEventHandlers = (
  canvas: HTMLCanvasElement,
  handlers: WPKPeripheralEventHandlers,
  eventsWindow: Window | undefined = window
): WPKEventListenerRemover => {
  if (typeof eventsWindow === 'undefined') {
    return {
      remove() {
      }
    };
  }
  const removers: WPKEventListenerRemover[] = [];
  const screenPosition: WPKCoords = [0, 0];
  const screenSize: WPKCoords = [0, 0];
  setupKeyHandlers(handlers, eventsWindow, removers);
  setupMouseHandlers(handlers, eventsWindow, removers, screenPosition, screenSize);
  setupScreenHandlers(canvas, handlers, eventsWindow, removers, screenPosition, screenSize);
  return {
    remove() {
      logFuncs.lazyInfo(LOGGER, () => `Removing ${removers.length} event handlers`);
      removers.forEach((remover) => {
        try {
          remover.remove();
        } catch (error) {
          logFuncs.lazyWarn(LOGGER, () => `Error when removing listener ${error}`);
        }
      });
      removers.length = 0;
    },
  };
};

const setupKeyHandlers = (
  handlers: WPKPeripheralEventHandlers,
  eventsWindow: Window,
  eventListenerRemovers: WPKEventListenerRemover[]
): void => {
  logFuncs.lazyInfo(LOGGER, () => 'Adding key event handlers');
  const handlerKeyDown = handlers[WPKPeripheralEventType.KEY_DOWN];
  const handlerKeyPress = handlers[WPKPeripheralEventType.KEY_PRESS];
  const handlerKeyUp = handlers[WPKPeripheralEventType.KEY_UP];
  if (handlerKeyDown !== undefined) {
    eventListenerRemovers.push(addKeyEventListener(eventsWindow, handlerKeyDown, WPKPeripheralEventType.KEY_DOWN, 'keydown'));
  }
  if (handlerKeyPress !== undefined) {
    eventListenerRemovers.push(addKeyEventListener(eventsWindow, handlerKeyPress, WPKPeripheralEventType.KEY_PRESS, 'keypress'));
  }
  if (handlerKeyUp !== undefined) {
    eventListenerRemovers.push(addKeyEventListener(eventsWindow, handlerKeyUp, WPKPeripheralEventType.KEY_UP, 'keyup'));
  }
};

const setupMouseHandlers = (
  handlers: WPKPeripheralEventHandlers,
  eventsWindow: Window,
  eventListenerRemovers: WPKEventListenerRemover[],
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
): void => {
  logFuncs.lazyInfo(LOGGER, () => 'Adding mouse event handlers');
  const handlerMouseDown = handlers[WPKPeripheralEventType.MOUSE_DOWN];
  const handlerMouseDrag = handlers[WPKPeripheralEventType.MOUSE_DRAG];
  const handlerMouseUp = handlers[WPKPeripheralEventType.MOUSE_UP];
  const handlerMouseMove = handlers[WPKPeripheralEventType.MOUSE_MOVE];
  const isMouseMoveRequired = (handlerMouseDrag !== undefined) || (handlerMouseMove !== undefined);
  const isMouseDownRequired = isMouseMoveRequired || (handlerMouseDown !== undefined);
  const isMouseUpRequired = (handlerMouseUp !== undefined);
  const mousePosition: WPKCoords = [0, 0];
  const mouseDrag: WPKCoords = [0, 0];
  const mouseDown: WPKCoords = [-1, -1];
  const mouseDownButton = changeDetectorFactory.ofTripleEquals<WPKMouseButton>(WPKMouseButton.LEFT);
  if (isMouseMoveRequired) {
    logFuncs.lazyInfo(LOGGER, () => 'Adding mouse move listener');
    eventListenerRemovers.push(addMouseMoveListener(eventsWindow, handlerMouseDrag, handlerMouseMove, screenPosition, screenSize, mousePosition, mouseDrag, mouseDown, mouseDownButton));
  }
  if (isMouseDownRequired) {
    eventListenerRemovers.push(addMouseButtonListener(eventsWindow, handlerMouseDown, WPKPeripheralEventType.MOUSE_DOWN, 'mousedown', screenPosition, screenSize, mousePosition, mouseDown, mouseDownButton));
  }
  if (isMouseUpRequired) {
    eventListenerRemovers.push(addMouseButtonListener(eventsWindow, handlerMouseUp, WPKPeripheralEventType.MOUSE_UP, 'mouseup', screenPosition, screenSize, mousePosition, mouseDown, mouseDownButton));
  }
};

const setupScreenHandlers = (
  canvas: HTMLCanvasElement,
  handlers: WPKPeripheralEventHandlers,
  eventsWindow: Window,
  eventListenerRemovers: WPKEventListenerRemover[],
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
): void => {
  logFuncs.lazyInfo(LOGGER, () => 'Adding screen event handlers');
  const handlerScreenResize = handlers[WPKPeripheralEventType.SCREEN_RESIZE];
  const isScreenResizeRequired = (handlerScreenResize !== undefined)
    || (handlers[WPKPeripheralEventType.MOUSE_DOWN] !== undefined)
    || (handlers[WPKPeripheralEventType.MOUSE_DRAG] !== undefined)
    || (handlers[WPKPeripheralEventType.MOUSE_MOVE] !== undefined)
    || (handlers[WPKPeripheralEventType.MOUSE_UP] !== undefined)
    ;
  if (isScreenResizeRequired) {
    updateScreenBounds(eventsWindow, canvas, screenPosition, screenSize);
    eventListenerRemovers.push(addScreenResizeListener(eventsWindow, handlerScreenResize, canvas, screenPosition, screenSize));
    if (handlerScreenResize !== undefined) {
      const eventInfo: WPKScreenEventInfo = {
        width: screenSize[0],
        height: screenSize[1],
        aspectRatio: screenSize[0] / screenSize[1],
        timestamp: 0,
      };
      invokeHandler(handlerScreenResize, WPKPeripheralEventType.SCREEN_RESIZE, eventInfo);
    }
  }
};

const addKeyEventListener = <TEventType extends WPKPeripheralEventType.KEY_DOWN | WPKPeripheralEventType.KEY_PRESS | WPKPeripheralEventType.KEY_UP>(
  eventsWindow: Window,
  handler: WPKPeripheralEventHandler<TEventType>,
  eventType: TEventType,
  eventName: 'keydown' | 'keypress' | 'keyup'
): WPKEventListenerRemover => {
  const listener = (event: KeyboardEvent) => {
    logFuncs.lazyTrace(LOGGER, () => `Handling ${eventName} event`);
    invokeHandler(handler, eventType, toKeyEventInfo(event));
  };
  logFuncs.lazyInfo(LOGGER, () => `Adding ${eventName} listener`);
  eventsWindow.addEventListener(eventName, listener, { passive: true });
  return {
    remove() {
      logFuncs.lazyInfo(LOGGER, () => `Removing ${eventName} listener`);
      eventsWindow.removeEventListener(eventName, listener);
    },
  };
};

const addMouseMoveListener = (
  eventsWindow: Window,
  mouseDragHandler: WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_DRAG> | undefined,
  mouseMoveHandler: WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_MOVE> | undefined,
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
  mousePosition: WPKCoords,
  mouseDrag: WPKCoords,
  mouseDown: WPKCoords,
  mouseDownButton: WPKChangeDetector<WPKMouseButton>
): WPKEventListenerRemover => {
  const listener = (event: MouseEvent) => {
    logFuncs.lazyTrace(LOGGER, () => `Handling ${event.type} event`);
    updateMousePositions(event, screenPosition, mousePosition);
    if (event.buttons > 0) {
      //mouse drag
      if (mouseDragHandler !== undefined) {
        if (mouseDown[0] === -1 || mouseDown[1] === -1) {
          logFuncs.lazyTrace(LOGGER, () => 'Waiting for mouse down event before sending drag events');
        } else {
          mouseDrag[0] = mousePosition[0] - mouseDown[0];
          mouseDrag[1] = mousePosition[1] - mouseDown[1];
          const eventInfo = toMouseDragEventInfo(event, screenSize, mousePosition, mouseDrag, mouseDownButton);
          invokeHandler(mouseDragHandler, WPKPeripheralEventType.MOUSE_DRAG, eventInfo);
        }
      }
    } else {
      // mouse move
      if (mouseMoveHandler !== undefined) {
        const eventInfo = toMouseMoveEventInfo(event, screenSize, mousePosition);
        invokeHandler(mouseMoveHandler, WPKPeripheralEventType.MOUSE_MOVE, eventInfo);
      }
    }
  };
  logFuncs.lazyInfo(LOGGER, () => 'Adding mousemove listener');
  eventsWindow.addEventListener('mousemove', listener, { passive: true });
  return {
    remove() {
      logFuncs.lazyInfo(LOGGER, () => 'Removing mousemove listener');
      eventsWindow.removeEventListener('mousemove', listener);
    },
  };
};

const buttonMap: Record<number, WPKMouseButton> = {
  0: WPKMouseButton.LEFT,
  1: WPKMouseButton.MIDDLE,
  2: WPKMouseButton.RIGHT,
  3: WPKMouseButton.BACK,
  4: WPKMouseButton.FORWARD,
};

const addMouseButtonListener = <TEventType extends WPKPeripheralEventType.MOUSE_DOWN | WPKPeripheralEventType.MOUSE_UP>(
  eventsWindow: Window,
  handler: WPKPeripheralEventHandler<TEventType> | undefined,
  eventType: TEventType,
  eventName: 'mousedown' | 'mouseup',
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
  mousePosition: WPKCoords,
  mouseDown: WPKCoords,
  mouseDownButton: WPKChangeDetector<WPKMouseButton>
): WPKEventListenerRemover => {
  const listener = createRAFThrottledHandler((event: MouseEvent) => {
    logFuncs.lazyTrace(LOGGER, () => `Handling ${event.type} event`);
    const { button } = event;
    if (eventName === 'mousedown') {
      const mouseButton = buttonMap[button];
      if (mouseButton === undefined) {
        mouseDownButton.compareAndUpdate(mouseButton);
      } else {
        logFuncs.lazyWarn(LOGGER, () => `Mouse button ${button} will not trigger events`);
      }
    }
    updateMousePositions(event, screenPosition, mousePosition);
    if (eventName === 'mousedown') {
      mouseDown[0] = mousePosition[0];
      mouseDown[1] = mousePosition[1];
    } else {
      mouseDown[0] = -1;
      mouseDown[1] = -1;
    }
    if (handler !== undefined) {
      const eventInfo = toMouseButtonEventInfo(event, screenSize, mousePosition, mouseDownButton);
      invokeHandler(handler, eventType, eventInfo);
    }
  });
  logFuncs.lazyInfo(LOGGER, () => `Adding ${eventName} event listener`);
  eventsWindow.addEventListener(eventName, listener, { passive: true });
  return {
    remove() {
      logFuncs.lazyInfo(LOGGER, () => `Removing ${eventName} event listener`);
      eventsWindow.removeEventListener(eventName, listener);
    },
  };
};

const addScreenResizeListener = (
  eventsWindow: Window,
  handler: WPKPeripheralEventHandler<WPKPeripheralEventType.SCREEN_RESIZE> | undefined,
  canvas: HTMLCanvasElement,
  screenPosition: WPKCoords,
  screenSize: WPKCoords
): WPKEventListenerRemover => {
  const listener = createRAFThrottledHandler((event: UIEvent) => {
    logFuncs.lazyInfo(LOGGER, () => `Handling ${event.type} event`);
    updateScreenBounds(eventsWindow, canvas, screenPosition, screenSize);
    if (handler !== undefined) {
      const eventInfo = {
        width: screenSize[0],
        height: screenSize[1],
        aspectRatio: screenSize[0] / screenSize[1],
        timestamp: event.timeStamp,
      };
      invokeHandler(handler, WPKPeripheralEventType.SCREEN_RESIZE, eventInfo);
    }
  });
  logFuncs.lazyInfo(LOGGER, () => 'Adding resize event listener');
  eventsWindow.addEventListener('resize', listener, { passive: true });
  return {
    remove() {
      logFuncs.lazyInfo(LOGGER, () => 'Removing resize event listener');
      eventsWindow.removeEventListener('resize', listener);
    },
  };
};

const updateScreenBounds = (
  eventsWindow: Window,
  canvas: HTMLCanvasElement,
  screenPosition: WPKCoords,
  screenSize: WPKCoords
): void => {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  screenPosition[0] = left;
  screenPosition[1] = top;
  screenSize[0] = width;
  screenSize[1] = height;
  const pixelRatio = eventsWindow.devicePixelRatio || 1;
  const desiredWidth = Math.floor(width * pixelRatio);
  const desiredHeight = Math.floor(height * pixelRatio);
  if (canvas.width !== desiredWidth) {
    canvas.width = desiredWidth;
  }
  if (canvas.height !== desiredHeight) {
    canvas.height = desiredHeight;
  }
  logFuncs.lazyTrace(LOGGER, () => `Updated screen position ${screenPosition} and size ${screenSize}`);
};

const updateMousePositions = (
  event: MouseEvent,
  screenPosition: WPKCoords,
  mousePosition: WPKCoords,
): void => {
  const { clientX, clientY } = event;
  mousePosition[0] = clientX - screenPosition[0];
  mousePosition[1] = clientY - screenPosition[1];
};

const toKeyEventInfo = (event: KeyboardEvent): WPKKeyEventInfo => ({
  code: event.code,
  key: event.key,
  modifiers: {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  },
  isRepeat: event.repeat,
  timestamp: event.timeStamp,
});

const toMouseButtonEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords, mouseDownButton: WPKChangeDetector<WPKMouseButton>): WPKMouseButtonEventInfo => ({
  position: toScreenXY(screenSize, mousePosition),
  trigger: mouseDownButton.get(),
  pressed: toMouseButtons(event),
  repeatCount: event.detail,
  timestamp: event.timeStamp,
});

const toMouseMoveEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords): WPKMouseMoveEventInfo => ({
  position: toScreenXY(screenSize, mousePosition),
  timestamp: event.timeStamp,
});

const toMouseDragEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords, mouseDrag: WPKCoords, mouseDownButton: WPKChangeDetector<WPKMouseButton>): WPKMouseDragEventInfo => ({
  position: toScreenXY(screenSize, mousePosition),
  drag: toScreenXY(screenSize, mouseDrag),
  trigger: mouseDownButton.get(),
  pressed: toMouseButtons(event),
  repeatCount: event.detail,
  timestamp: event.timeStamp,
});

const toMouseButtons = (event: MouseEvent): WPKMouseButton[] => {
  const { buttons } = event;
  const buttonsPressed: WPKMouseButton[] = [];
  if (buttons & 1) {
    buttonsPressed.push(WPKMouseButton.LEFT);
  }
  if (buttons & 2) {
    buttonsPressed.push(WPKMouseButton.RIGHT);
  }
  if (buttons & 4) {
    buttonsPressed.push(WPKMouseButton.MIDDLE);
  }
  if (buttons & 8) {
    buttonsPressed.push(WPKMouseButton.BACK);
  }
  if (buttons & 16) {
    buttonsPressed.push(WPKMouseButton.FORWARD);
  }
  return buttonsPressed;
};

const toScreenXY = (screenSize: WPKCoords, mousePosition: WPKCoords): WPKScreenXY => {
  const x = mousePosition[0];
  const y = mousePosition[1];
  return {
    absolute: {
      x,
      y,
    },
    normalized: {
      x: x / screenSize[0],
      y: y / screenSize[1],
    },
  };
};

const invokeHandler = <TEventType extends keyof WPKPeripheralEventHandlers>(
  handler: WPKPeripheralEventHandler<TEventType>,
  eventType: TEventType,
  eventInfo: WPKPeripheralEventInfoTypeMap[TEventType]
): void => {
  try {
    handler(eventInfo);
  } catch (error) {
    logFuncs.lazyError(LOGGER, () => `Error in ${eventType} handler. ${error}`);
  }
};

const createRAFThrottledHandler = <T extends (...args: any[]) => void>(fn: T): T => {
  let ticking = false;
  let latestArgs: any[] = [];
  return ((...args: any[]) => {
    latestArgs = args;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        fn(...latestArgs);
        ticking = false;
      });
    }
  }) as T;
};
