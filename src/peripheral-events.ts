import { logFactory } from './logging';
import { WPKKeyEventInfo, WPKMouseButton, WPKMouseButtonEventInfo, WPKMouseDragEventInfo, WPKMouseMoveEventInfo, WPKPeripheralEventHandler, WPKPeripheralEventHandlers, WPKPeripheralEventType, WPKScreenXY } from './types';
import { changeDetectorFactory, logFuncs, WPKChangeDetector } from './utils';

const LOGGER = logFactory.getLogger('events');

type WPKCoords = [number, number];

export const addPeripheralEventHandlers = async (canvas: HTMLCanvasElement, handlers: WPKPeripheralEventHandlers): Promise<void> => {
  if (window === undefined) {
    logFuncs.lazyInfo(LOGGER, () => 'Not adding event handlers as window is undefined');
    return;
  }
  addKeyEventListener(canvas, handlers, WPKPeripheralEventType.KEY_DOWN, 'keydown');
  addKeyEventListener(canvas, handlers, WPKPeripheralEventType.KEY_PRESS, 'keypress');
  addKeyEventListener(canvas, handlers, WPKPeripheralEventType.KEY_UP, 'keyup');
  const isMouseMoveRequired = hasEventType(handlers, WPKPeripheralEventType.MOUSE_DRAG) || hasEventType(handlers, WPKPeripheralEventType.MOUSE_MOVE);
  const isMouseDownRequired = isMouseMoveRequired || hasEventType(handlers, WPKPeripheralEventType.MOUSE_DOWN);
  const isMouseUpRequired = hasEventType(handlers, WPKPeripheralEventType.MOUSE_UP);
  const isScreenResizeRequired = isMouseDownRequired || isMouseUpRequired || hasEventType(handlers, WPKPeripheralEventType.SCREEN_RESIZE);
  const mousePosition: WPKCoords = [0, 0];
  const mouseDelta: WPKCoords = [0, 0];
  const mouseButtonChangePosition: WPKCoords = [0, 0];
  const mouseButtonTrigger = changeDetectorFactory.ofTripleEquals<WPKMouseButton>(WPKMouseButton.LEFT);
  const screenPosition: WPKCoords = [0, 0];
  const screenSize: WPKCoords = [0, 0];
  if (isMouseMoveRequired) {
    addMouseMoveListener(handlers, screenPosition, screenSize, mousePosition, mouseDelta, mouseButtonChangePosition, mouseButtonTrigger);
  }
  if (isMouseDownRequired) {
    addMouseButtonListener(handlers[WPKPeripheralEventType.MOUSE_DOWN], 'mousedown', screenPosition, screenSize, mousePosition, mouseDelta, mouseButtonChangePosition, mouseButtonTrigger);
  }
  if (isMouseUpRequired) {
    addMouseButtonListener(handlers[WPKPeripheralEventType.MOUSE_UP], 'mouseup', screenPosition, screenSize, mousePosition, mouseDelta, mouseButtonChangePosition, mouseButtonTrigger);
  }
  if (isScreenResizeRequired) {
    addScreenResizeListener(handlers, canvas, screenPosition, screenSize);
  }
};

const hasEventType = (handlers: WPKPeripheralEventHandlers, eventType: WPKPeripheralEventType): boolean => (handlers[eventType] !== undefined);

const addKeyEventListener = async (
  canvas: HTMLCanvasElement,
  handlers: WPKPeripheralEventHandlers,
  eventType: WPKPeripheralEventType.KEY_DOWN | WPKPeripheralEventType.KEY_PRESS | WPKPeripheralEventType.KEY_UP,
  eventName: 'keydown' | 'keypress' | 'keyup'
): Promise<void> => {
  const handler = handlers[eventType];
  if (handler !== undefined) {
    logFuncs.lazyInfo(LOGGER, () => `Adding ${eventType} listener`);
    window.addEventListener(eventName, async (event) => {
      logFuncs.lazyInfo(LOGGER, () => `Handling ${eventName} event`);
      await handler(toKeyEventInfo(canvas, event));
    });
  }
};

const addMouseMoveListener = async (
  handlers: WPKPeripheralEventHandlers,
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
  mousePosition: WPKCoords,
  mouseDelta: WPKCoords,
  mouseDragStart: WPKCoords,
  mouseButtonTrigger: WPKChangeDetector<WPKMouseButton>
): Promise<void> => {
  const mouseDragHandler = handlers[WPKPeripheralEventType.MOUSE_DRAG];
  const mouseMoveHandler = handlers[WPKPeripheralEventType.MOUSE_MOVE];
  window.addEventListener('mousemove', async (event) => {
    logFuncs.lazyTrace(LOGGER, () => `Handling ${event.type} event`);
    updateMousePositions(event, screenPosition, mousePosition, mouseDelta);
    if (event.buttons > 0) {
      //mouse drag
      if (mouseDragHandler !== undefined) {
        const eventInfo = toMouseDragEventInfo(event, screenSize, mousePosition, mouseDelta, mouseDragStart, mouseButtonTrigger);
        await mouseDragHandler(eventInfo);
      }
    } else {
      // mouse move
      if (mouseMoveHandler !== undefined) {
        const eventInfo = toMouseMoveEventInfo(event, screenSize, mousePosition, mouseDelta);
        await mouseMoveHandler(eventInfo);
      }
    }
  });
};

const MOUSE_BUTTONS = [WPKMouseButton.LEFT, WPKMouseButton.RIGHT, WPKMouseButton.MIDDLE];
const addMouseButtonListener = async (
  handler: WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_DOWN> | WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_UP> | undefined,
  eventName: 'mousedown' | 'mouseup',
  screenPosition: WPKCoords,
  screenSize: WPKCoords,
  mousePosition: WPKCoords,
  mouseDelta: WPKCoords,
  mouseButtonChangePosition: WPKCoords,
  mouseButtonTrigger: WPKChangeDetector<WPKMouseButton>
): Promise<void> => {
  if (handler !== undefined) {
    window.addEventListener(eventName, async (event) => {
      logFuncs.lazyInfo(LOGGER, () => `Handling ${event.type} event`);
      mouseButtonTrigger.compareAndUpdate(MOUSE_BUTTONS[event.button]);
      updateMousePositions(event, screenPosition, mousePosition, mouseDelta);
      mouseButtonChangePosition[0] = mousePosition[0];
      mouseButtonChangePosition[1] = mousePosition[1];
      if (handler !== undefined) {
        const eventInfo = toMouseButtonEventInfo(event, screenSize, mousePosition, mouseButtonTrigger);
        handler(eventInfo);
      }
    });
  }
};

const addScreenResizeListener = async (
  handlers: WPKPeripheralEventHandlers,
  canvas: HTMLCanvasElement,
  screenPosition: WPKCoords,
  screenSize: WPKCoords
): Promise<void> => {
  const screenResizeHandler = handlers[WPKPeripheralEventType.SCREEN_RESIZE];
  window.addEventListener('resize', async (event) => {
    logFuncs.lazyInfo(LOGGER, () => `Handling ${event.type} event`);
    const { left, top, width, height } = canvas.getBoundingClientRect();
    screenPosition[0] = left;
    screenPosition[1] = top;
    screenSize[0] = width;
    screenSize[1] = height;
    if (screenResizeHandler !== undefined) {
      const eventInfo = {
        width,
        height,
        aspectRatio: width / height,
        timestamp: event.timeStamp,
      };
      await screenResizeHandler(eventInfo);
    }
  });
};

const updateMousePositions = (
  event: MouseEvent,
  screenPosition: WPKCoords,
  mousePosition: WPKCoords,
  mouseDelta: WPKCoords
): void => {
  const [prevX, prevY] = mousePosition;
  const { clientX, clientY } = event;
  mousePosition[0] = clientX - screenPosition[0];
  mousePosition[1] = clientY - screenPosition[1];
  mouseDelta[0] = mousePosition[0] - prevX;
  mouseDelta[1] = mousePosition[1] - prevY;
};

const toKeyEventInfo = (_canvas: HTMLCanvasElement, event: KeyboardEvent): WPKKeyEventInfo => {
  const { code, key, altKey, ctrlKey, metaKey, shiftKey, repeat, timeStamp } = event;
  return {
    code,
    key,
    modifiers: {
      alt: altKey,
      ctrl: ctrlKey,
      meta: metaKey,
      shift: shiftKey,
    },
    isRepeat: repeat,
    timestamp: timeStamp,
  };
};

const toMouseButtonEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords, mouseButtonTrigger: WPKChangeDetector<WPKMouseButton>): WPKMouseButtonEventInfo => ({
  position: toScreenXY(screenSize, mousePosition),
  trigger: mouseButtonTrigger.get(),
  pressed: toMouseButtons(event),
  repeatCount: event.detail,
  timestamp: event.timeStamp,
});

const toMouseMoveEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords, mouseDelta: WPKCoords): WPKMouseMoveEventInfo => ({
  position: toScreenXY(screenSize, mousePosition),
  delta: toScreenXY(screenSize, mouseDelta),
  timestamp: event.timeStamp,
});

const toMouseDragEventInfo = (event: MouseEvent, screenSize: WPKCoords, mousePosition: WPKCoords, mouseDelta: WPKCoords, mouseDragStart: WPKCoords, mouseButtonTrigger: WPKChangeDetector<WPKMouseButton>): WPKMouseDragEventInfo => ({
  delta: toScreenXY(screenSize, mouseDelta),
  drag: toScreenXY(screenSize, mouseDragStart),
  position: toScreenXY(screenSize, mousePosition),
  trigger: mouseButtonTrigger.get(),
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
