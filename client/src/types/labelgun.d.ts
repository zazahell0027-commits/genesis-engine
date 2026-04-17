declare module "labelgun" {
  export type LabelgunBoundingBox = {
    bottomLeft: [number, number];
    topRight: [number, number];
  };

  export type LabelgunLabel<T = unknown> = {
    id: string | number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    state: "show" | "hide";
    weight: number;
    labelObject: T;
    name: string;
    isDragged: boolean;
  };

  export default class Labelgun<T = unknown> {
    constructor(
      hideLabel: (label: LabelgunLabel<T>) => void,
      showLabel: (label: LabelgunLabel<T>) => void,
      entries?: number
    );

    ingestLabel(
      boundingBox: LabelgunBoundingBox,
      id: string | number,
      weight: number,
      labelObject: T,
      labelName: string,
      isDragged: boolean
    ): void;

    labelHasChanged(id: string | number): void;
    update(onlyChanges?: boolean): void;
    removeLabel(id: string | number, label?: LabelgunLabel<T>): void;
    reset(): void;
    totalHidden(): number;
    totalShown(): number;
    getHidden(): Array<LabelgunLabel<T>>;
    getShown(): Array<LabelgunLabel<T>>;
    getLabel(id: string | number): LabelgunLabel<T> | undefined;
    getCollisions(id: string | number): Array<LabelgunLabel<T>>;
  }
}
