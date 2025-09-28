export enum WPKPeripheralEventType {
  KEY_DOWN = 'key-down',
  KEY_PRESS = 'key-press',
  KEY_UP = 'key-up',
  MOUSE_DOWN = 'mouse-down',
  MOUSE_DRAG = 'mouse-drag',
  MOUSE_UP = 'mouse-up',
  MOUSE_MOVE = 'mouse-move',
  SCREEN_RESIZE = 'screen-resize',
};
export type WPKPeripheralEventInfoTypeMap = {
  [WPKPeripheralEventType.KEY_DOWN]: WPKKeyEventInfo,
  [WPKPeripheralEventType.KEY_PRESS]: WPKKeyEventInfo,
  [WPKPeripheralEventType.KEY_UP]: WPKKeyEventInfo,
  [WPKPeripheralEventType.MOUSE_DOWN]: WPKMouseButtonEventInfo,
  [WPKPeripheralEventType.MOUSE_DRAG]: WPKMouseDragEventInfo,
  [WPKPeripheralEventType.MOUSE_UP]: WPKMouseButtonEventInfo,
  [WPKPeripheralEventType.MOUSE_MOVE]: WPKMouseMoveEventInfo,
  [WPKPeripheralEventType.SCREEN_RESIZE]: WPKScreenEventInfo,
};
export enum WPKMouseButton {
  LEFT = 'left',
  MIDDLE = 'middle',
  RIGHT = 'right',
  BACK = 'back',
  FORWARD = 'forward',
};
type WPKKeyModifiers = {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};
export type WPKScreenXY = {
  normalized: {
    x: number;
    y: number;
  };
  absolute: {
    x: number;
    y: number;
  };
};
type WPKPeripheralEventBase = {
  timestamp: number;
};
export type WPKKeyEventInfo = WPKPeripheralEventBase & {
  key: string;
  code: string;
  isRepeat: boolean;
  modifiers: WPKKeyModifiers;
};
type WPKMouseEventInfoBase = WPKPeripheralEventBase & {
  position: WPKScreenXY;
};
export type WPKMouseButtonEventInfo = WPKMouseEventInfoBase & {
  trigger: WPKMouseButton;
  pressed: WPKMouseButton[];
  repeatCount: number;
};
export type WPKMouseMoveEventInfo = WPKMouseEventInfoBase & {
};
export type WPKMouseDragEventInfo = WPKMouseButtonEventInfo & WPKMouseMoveEventInfo & {
  drag: WPKScreenXY;
};
export type WPKScreenEventInfo = WPKPeripheralEventBase & {
  width: number;
  height: number;
  aspectRatio: number;
};

export type WPKPeripheralEventHandler<TEvent extends keyof WPKPeripheralEventInfoTypeMap> = (eventInfo: WPKPeripheralEventInfoTypeMap[TEvent]) => any;
export type WPKPeripheralEventHandlers = {
  [E in keyof WPKPeripheralEventInfoTypeMap]?: WPKPeripheralEventHandler<E>;
};
export type WPKEventListenerRemover = {
  remove: () => void;
};
