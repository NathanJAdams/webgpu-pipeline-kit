import { logFactory } from './logging';
import { WPKKeyEventInfo, WPKMouseButton, WPKMouseEventInfo, WPKPeripheralEventHandler, WPKPeripheralEventHandlers, WPKPeripheralEventType, WPKScreenEventInfo } from './types';
import { logFuncs } from './utils';

const LOGGER = logFactory.getLogger('events');

export const addPeripheralEventHandlers = async (canvas: HTMLCanvasElement, peripheralEventHandlers: WPKPeripheralEventHandlers): Promise<void> => {
  for (const [eventType, eventHandler] of Object.entries(peripheralEventHandlers)) {
    switch (eventType) {
      case WPKPeripheralEventType.DRAG_START:
        addDragEventListener(canvas, 'dragstart', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.DRAG_START>);
        break;
      case WPKPeripheralEventType.DRAG:
        addDragEventListener(canvas, 'drag', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.DRAG>);
        break;
      case WPKPeripheralEventType.DRAG_END:
        addDragEventListener(canvas, 'dragend', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.DRAG_END>);
        break;
      case WPKPeripheralEventType.KEY_DOWN:
        addKeyEventListener(canvas, 'keydown', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.KEY_DOWN>);
        break;
      case WPKPeripheralEventType.KEY_UP:
        addKeyEventListener(canvas, 'keyup', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.KEY_UP>);
        break;
      case WPKPeripheralEventType.KEY_PRESS:
        addKeyEventListener(canvas, 'keypress', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.KEY_PRESS>);
        break;
      case WPKPeripheralEventType.MOUSE_DOWN:
        addMouseEventListener(canvas, 'mousedown', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_DOWN>);
        break;
      case WPKPeripheralEventType.MOUSE_MOVE:
        addMouseEventListener(canvas, 'mousemove', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_MOVE>);
        break;
      case WPKPeripheralEventType.MOUSE_UP:
        addMouseEventListener(canvas, 'mouseup', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.MOUSE_UP>);
        break;
      case WPKPeripheralEventType.SCREEN_RESIZE:
        await addScreenEventListener(canvas, 'resize', eventHandler as WPKPeripheralEventHandler<WPKPeripheralEventType.SCREEN_RESIZE>);
        break;
      default:
        throw Error(`Unrecognized peripheral event ${eventType}`);
    }
  }
};

const addDragEventListener = async <TEventType extends WPKPeripheralEventType.DRAG_START | WPKPeripheralEventType.DRAG | WPKPeripheralEventType.DRAG_END>(
  canvas: HTMLCanvasElement,
  eventName: 'dragstart' | 'drag' | 'dragend',
  eventHandler: WPKPeripheralEventHandler<TEventType>,
): Promise<void> => {
  if (window !== undefined) {
    logFuncs.lazyInfo(LOGGER, () => `Adding ${eventName} listener`);
    window.addEventListener(eventName, async (event) => await eventHandler(toMouseEventInfo(canvas, event)));
  }
};

const addKeyEventListener = async <TEventType extends WPKPeripheralEventType.KEY_DOWN | WPKPeripheralEventType.KEY_PRESS | WPKPeripheralEventType.KEY_UP>(
  canvas: HTMLCanvasElement,
  eventName: 'keydown' | 'keypress' | 'keyup',
  eventHandler: WPKPeripheralEventHandler<TEventType>
): Promise<void> => {
  if (window !== undefined) {
    logFuncs.lazyInfo(LOGGER, () => `Adding ${eventName} listener`);
    window.addEventListener(eventName, async (event) => await eventHandler(toKeyEventInfo(canvas, event)));
  }
};

const addMouseEventListener = async <TEventType extends WPKPeripheralEventType.MOUSE_DOWN | WPKPeripheralEventType.MOUSE_MOVE | WPKPeripheralEventType.MOUSE_UP>(
  canvas: HTMLCanvasElement,
  eventName: 'mousedown' | 'mousemove' | 'mouseup',
  eventHandler: WPKPeripheralEventHandler<TEventType>,
): Promise<void> => {
  if (window !== undefined) {
    logFuncs.lazyInfo(LOGGER, () => `Adding ${eventName} listener`);
    window.addEventListener(eventName, async (event) => await eventHandler(toMouseEventInfo(canvas, event)));
  }
};

const addScreenEventListener = async <TEventType extends WPKPeripheralEventType.SCREEN_RESIZE>(
  canvas: HTMLCanvasElement,
  eventName: 'resize',
  eventHandler: WPKPeripheralEventHandler<TEventType>
): Promise<void> => {
  const eventListener = async (uiEvent: UIEvent) => {
    const { clientWidth, clientHeight } = canvas;
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
      logFuncs.lazyDebug(LOGGER, () => `Resizing canvas to [${clientWidth}, ${clientHeight}]`);
      canvas.width = clientWidth;
      canvas.height = clientHeight;
      const eventInfo: WPKScreenEventInfo = {
        width: clientWidth,
        height: clientHeight,
        aspectRatio: clientWidth / clientHeight,
        timestamp: uiEvent.timeStamp,
      };
      await eventHandler(eventInfo);
    }
  };
  await eventListener({ timeStamp: Date.now() } as UIEvent); // ensure screen is resized to begin with
  if (window !== undefined) {
    logFuncs.lazyInfo(LOGGER, () => 'Adding resize listener');
    window.addEventListener(eventName, async (event) => await eventListener(event));
  }
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
    isRepeated: repeat,
    timestamp: timeStamp,
  };
};

const toMouseEventInfo = (canvas: HTMLCanvasElement, event: DragEvent | MouseEvent): WPKMouseEventInfo => {
  const { button, detail, timeStamp } = event;
  const buttonsPressed = toMouseButtons(event);
  const buttonTriggered = toMouseButton(button);
  const xy = toRelativeXY(canvas, event);
  return {
    ...xy,
    buttonsPressed,
    buttonTriggered,
    clickCountInSequence: detail,
    timestamp: timeStamp,
  };
};

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

const toMouseButton = (buttonIndex: number): WPKMouseButton => {
  switch (buttonIndex) {
    case 0: return WPKMouseButton.LEFT;
    case 1: return WPKMouseButton.MIDDLE;
    case 2: return WPKMouseButton.RIGHT;
    default: return WPKMouseButton.LEFT;
  }
};

const toRelativeXY = (canvas: HTMLCanvasElement, event: MouseEvent): { x: number; y: number; } => {
  const { width: canvasWidth, height: canvasHeight } = canvas;
  const { clientX, clientY } = event;
  const rect = canvas.getBoundingClientRect();
  const relativeX = clientX - rect.left;
  const relativeY = clientY - rect.top;
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;
  const canvasX = relativeX * scaleX;
  const canvasY = relativeY * scaleY;
  const normalizedX = canvasX / canvasWidth;
  const normalizedY = canvasY / canvasHeight;
  const x = Math.min(Math.max(normalizedX, 0), 1);
  const y = Math.min(Math.max(normalizedY, 0), 1);
  return {
    x,
    y,
  };
};
