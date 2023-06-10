import classnames from 'classnames';
import type { DialogProps as IDialogPropTypes } from 'rc-dialog';
import Dialog from 'rc-dialog';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import KeyCode from 'rc-util/lib/KeyCode';
import { warning } from 'rc-util/lib/warning';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import getFixScaleEleTransPosition from './getFixScaleEleTransPosition';
import type { TransformAction, TransformType } from './hooks/useImageTransform';
import useImageTransform from './hooks/useImageTransform';
import Operations from './Operations';
import { BASE_SCALE_RATIO, WHEEL_MAX_SCALE_RATIO } from './previewConfig';
import { context } from './PreviewGroup';

export type ToolbarRenderType = {
  originalNode: React.ReactNode;
  icons: {
    flipYIcon: React.ReactNode;
    flipXIcon: React.ReactNode;
    rotateLeftIcon: React.ReactNode;
    rotateRightIcon: React.ReactNode;
    zoomOutIcon: React.ReactNode;
    zoomInIcon: React.ReactNode;
    closeIcon: React.ReactNode;
  };
  actions: {
    flipY: () => void;
    flipX: () => void;
    rotateLeft: () => void;
    rotateRight: () => void;
    zoomOut: () => void;
    zoomIn: () => void;
    close: () => void;
  };
  current: number;
  total: number;
};

export interface PreviewProps extends Omit<IDialogPropTypes, 'onClose'> {
  imgCommonProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  src?: string;
  alt?: string;
  rootClassName?: string;
  icons?: {
    rotateLeft?: React.ReactNode;
    rotateRight?: React.ReactNode;
    zoomIn?: React.ReactNode;
    zoomOut?: React.ReactNode;
    close?: React.ReactNode;
    left?: React.ReactNode;
    right?: React.ReactNode;
    flipX?: React.ReactNode;
    flipY?: React.ReactNode;
  };
  countRender?: (current: number, total: number) => string;
  scaleStep?: number;
  imageRender?: (params: {
    originalNode: React.ReactNode;
    transform: TransformType;
    current?: number;
  }) => React.ReactNode;
  onClose?: () => void;
  onTransform?: (params: { transform: TransformType; action: TransformAction }) => void;
  toolbarRender?: (params: ToolbarRenderType) => React.ReactNode;
}

const Preview: React.FC<PreviewProps> = props => {
  const {
    prefixCls,
    src,
    alt,
    onClose,
    visible,
    icons = {},
    rootClassName,
    getContainer,
    countRender,
    scaleStep = 0.5,
    transitionName = 'zoom',
    maskTransitionName = 'fade',
    imageRender,
    imgCommonProps,
    toolbarRender,
    onTransform,
    ...restProps
  } = props;

  const imgRef = useRef<HTMLImageElement>();
  const downPositionRef = useRef({
    deltaX: 0,
    deltaY: 0,
    transformX: 0,
    transformY: 0,
  });
  const [isMoving, setMoving] = useState(false);
  const { previewData, current, isPreviewGroup, setCurrent } = useContext(context);
  const previewGroupCount = previewData.size;
  const previewDataKeys = Array.from(previewData.keys());
  const currentPreviewIndex = previewDataKeys.indexOf(current);
  const showLeftOrRightSwitches = isPreviewGroup && previewGroupCount > 1;
  const showOperationsProgress = isPreviewGroup && previewGroupCount >= 1;
  const { transform, resetTransform, updateTransform, dispatchZoomChange } = useImageTransform(
    imgRef,
    onTransform,
  );
  const [enableTransition, setEnableTransition] = useState(true);
  const { rotate, scale } = transform;

  const wrapClassName = classnames({
    [`${prefixCls}-moving`]: isMoving,
  });

  useEffect(() => {
    if (!enableTransition) {
      setEnableTransition(true);
    }
  }, [enableTransition]);

  const onAfterClose = () => {
    resetTransform('close');
  };

  const onZoomIn = () => {
    dispatchZoomChange(BASE_SCALE_RATIO + scaleStep, 'zoomIn');
  };

  const onZoomOut = () => {
    dispatchZoomChange(BASE_SCALE_RATIO / (BASE_SCALE_RATIO + scaleStep), 'zoomOut');
  };

  const onRotateRight = () => {
    updateTransform({ rotate: rotate + 90 }, 'rotateRight');
  };

  const onRotateLeft = () => {
    updateTransform({ rotate: rotate - 90 }, 'rotateLeft');
  };

  const onFlipX = () => {
    updateTransform({ flipX: !transform.flipX }, 'flipX');
  };

  const onFlipY = () => {
    updateTransform({ flipY: !transform.flipY }, 'flipY');
  };

  const onSwitchLeft: React.MouseEventHandler<HTMLDivElement> = event => {
    event.preventDefault();
    event.stopPropagation();
    if (currentPreviewIndex > 0) {
      setEnableTransition(false);
      resetTransform('switch');
      setCurrent(previewDataKeys[currentPreviewIndex - 1]);
    }
  };

  const onSwitchRight: React.MouseEventHandler<HTMLDivElement> = event => {
    event.preventDefault();
    event.stopPropagation();
    if (currentPreviewIndex < previewGroupCount - 1) {
      setEnableTransition(false);
      resetTransform('switch');
      setCurrent(previewDataKeys[currentPreviewIndex + 1]);
    }
  };

  const onMouseUp: React.MouseEventHandler<HTMLBodyElement> = () => {
    if (visible && isMoving) {
      setMoving(false);
      /** No need to restore the position when the picture is not moved, So as not to interfere with the click */
      const { transformX, transformY } = downPositionRef.current;
      const hasChangedPosition = transform.x !== transformX && transform.y !== transformY;
      if (!hasChangedPosition) {
        return;
      }

      const width = imgRef.current.offsetWidth * scale;
      const height = imgRef.current.offsetHeight * scale;
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const { left, top } = imgRef.current.getBoundingClientRect();
      const isRotate = rotate % 180 !== 0;

      const fixState = getFixScaleEleTransPosition(
        isRotate ? height : width,
        isRotate ? width : height,
        left,
        top,
      );

      if (fixState) {
        updateTransform({ ...fixState }, 'dragRebound');
      }
    }
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = event => {
    // Only allow main button
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    downPositionRef.current = {
      deltaX: event.pageX - transform.x,
      deltaY: event.pageY - transform.y,
      transformX: transform.x,
      transformY: transform.y,
    };
    setMoving(true);
  };

  const onMouseMove: React.MouseEventHandler<HTMLBodyElement> = event => {
    if (visible && isMoving) {
      updateTransform(
        {
          x: event.pageX - downPositionRef.current.deltaX,
          y: event.pageY - downPositionRef.current.deltaY,
        },
        'move',
      );
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLImageElement>) => {
    if (!visible || event.deltaY == 0) return;
    // Scale ratio depends on the deltaY size
    const scaleRatio = Math.abs(event.deltaY / 100);
    // Limit the maximum scale ratio
    const mergedScaleRatio = Math.min(scaleRatio, WHEEL_MAX_SCALE_RATIO);
    // Scale the ratio each time
    let ratio = BASE_SCALE_RATIO + mergedScaleRatio * scaleStep;
    if (event.deltaY > 0) {
      ratio = BASE_SCALE_RATIO / ratio;
    }
    dispatchZoomChange(ratio, 'wheel', event.clientX, event.clientY);
  };

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!visible || !showLeftOrRightSwitches) return;

      if (event.keyCode === KeyCode.LEFT) {
        if (currentPreviewIndex > 0) {
          setCurrent(previewDataKeys[currentPreviewIndex - 1]);
        }
      } else if (event.keyCode === KeyCode.RIGHT) {
        if (currentPreviewIndex < previewGroupCount - 1) {
          setCurrent(previewDataKeys[currentPreviewIndex + 1]);
        }
      }
    },
    [
      currentPreviewIndex,
      previewGroupCount,
      previewDataKeys,
      setCurrent,
      showLeftOrRightSwitches,
      visible,
    ],
  );

  const onDoubleClick = (event: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
    if (visible) {
      if (scale !== 1) {
        updateTransform({ x: 0, y: 0, scale: 1 }, 'doubleClick');
      } else {
        dispatchZoomChange(
          BASE_SCALE_RATIO + scaleStep,
          'doubleClick',
          event.clientX,
          event.clientY,
        );
      }
    }
  };

  useEffect(() => {
    let onTopMouseUpListener;
    let onTopMouseMoveListener;

    const onMouseUpListener = addEventListener(window, 'mouseup', onMouseUp, false);
    const onMouseMoveListener = addEventListener(window, 'mousemove', onMouseMove, false);
    const onKeyDownListener = addEventListener(window, 'keydown', onKeyDown, false);

    try {
      // Resolve if in iframe lost event
      /* istanbul ignore next */
      if (window.top !== window.self) {
        onTopMouseUpListener = addEventListener(window.top, 'mouseup', onMouseUp, false);
        onTopMouseMoveListener = addEventListener(window.top, 'mousemove', onMouseMove, false);
      }
    } catch (error) {
      /* istanbul ignore next */
      warning(false, `[rc-image] ${error}`);
    }

    return () => {
      onMouseUpListener.remove();
      onMouseMoveListener.remove();
      onKeyDownListener.remove();
      /* istanbul ignore next */
      onTopMouseUpListener?.remove();
      /* istanbul ignore next */
      onTopMouseMoveListener?.remove();
    };
  }, [visible, isMoving, onKeyDown]);

  const imgNode = (
    <img
      {...imgCommonProps}
      width={props.width}
      height={props.height}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      ref={imgRef}
      className={`${prefixCls}-img`}
      src={src}
      alt={alt}
      style={{
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale3d(${
          transform.flipX ? '-' : ''
        }${scale}, ${transform.flipY ? '-' : ''}${scale}, 1) rotate(${rotate}deg)`,
        transitionDuration: !enableTransition && '0s',
      }}
    />
  );

  return (
    <>
      <Dialog
        transitionName={transitionName}
        maskTransitionName={maskTransitionName}
        closable={false}
        keyboard
        prefixCls={prefixCls}
        onClose={onClose}
        visible={visible}
        wrapClassName={wrapClassName}
        rootClassName={rootClassName}
        getContainer={getContainer}
        {...restProps}
        afterClose={onAfterClose}
      >
        <div className={`${prefixCls}-img-wrapper`}>
          {imageRender
            ? imageRender({
                originalNode: imgNode,
                transform,
                ...(isPreviewGroup ? { current: currentPreviewIndex } : {}),
              })
            : imgNode}
        </div>
      </Dialog>
      <Operations
        visible={visible}
        maskTransitionName={maskTransitionName}
        getContainer={getContainer}
        prefixCls={prefixCls}
        rootClassName={rootClassName}
        icons={icons}
        countRender={countRender}
        showSwitch={showLeftOrRightSwitches}
        showProgress={showOperationsProgress}
        current={currentPreviewIndex}
        count={previewGroupCount}
        toolbarRender={toolbarRender}
        onSwitchLeft={onSwitchLeft}
        onSwitchRight={onSwitchRight}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onRotateRight={onRotateRight}
        onRotateLeft={onRotateLeft}
        onFlipX={onFlipX}
        onFlipY={onFlipY}
        onClose={onClose}
      />
    </>
  );
};

export default Preview;
