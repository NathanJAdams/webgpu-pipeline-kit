export enum WPKPeripheralEventType {
  KEY_DOWN = 'key-down',
  KEY_UP = 'key-up',
  KEY_PRESS = 'key-press',
  DRAG_START = 'drag-start',
  DRAG = 'drag',
  DRAG_END = 'drag-end',
  MOUSE_DOWN = 'mouse-down',
  MOUSE_UP = 'mouse-up',
  MOUSE_MOVE = 'mouse-move',
  SCREEN_RESIZE = 'screen-resize',
};
export type WPKPeripheralEventInfoTypeMap = {
  [WPKPeripheralEventType.KEY_DOWN]: WPKKeyEventInfo,
  [WPKPeripheralEventType.KEY_UP]: WPKKeyEventInfo,
  [WPKPeripheralEventType.KEY_PRESS]: WPKKeyEventInfo,
  [WPKPeripheralEventType.DRAG_START]: WPKMouseEventInfo,
  [WPKPeripheralEventType.DRAG]: WPKMouseEventInfo,
  [WPKPeripheralEventType.DRAG_END]: WPKMouseEventInfo,
  [WPKPeripheralEventType.MOUSE_DOWN]: WPKMouseEventInfo,
  [WPKPeripheralEventType.MOUSE_UP]: WPKMouseEventInfo,
  [WPKPeripheralEventType.MOUSE_MOVE]: WPKMouseEventInfo,
  [WPKPeripheralEventType.SCREEN_RESIZE]: WPKScreenEventInfo,
};
export enum WPKMouseButton {
  LEFT = 'left',
  MIDDLE = 'middle',
  RIGHT = 'right',
};
type WPKKeyModifiers = {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};
type WPKPeripheralEventBase = {
  timestamp: number;
};
export type WPKKeyEventInfo = WPKPeripheralEventBase & {
  key: string;
  code: string;
  isRepeated: boolean;
  modifiers: WPKKeyModifiers;
};
export type WPKMouseEventInfo = WPKPeripheralEventBase & {
  x: number;
  y: number;
  buttonTriggered: WPKMouseButton;
  buttonsPressed: WPKMouseButton[];
  clickCountInSequence: number;
};
export type WPKScreenEventInfo = WPKPeripheralEventBase & {
  width: number;
  height: number;
  aspectRatio: number;
};

export type WPKPeripheralEventHandler<TEvent extends keyof WPKPeripheralEventInfoTypeMap> = (eventInfo: WPKPeripheralEventInfoTypeMap[TEvent]) => Promise<any>;
export type WPKPeripheralEventHandlers = {
  [E in keyof WPKPeripheralEventInfoTypeMap]?: WPKPeripheralEventHandler<E>;
};
