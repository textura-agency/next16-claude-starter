//@ts-nocheck

const getElementCoords = (domElement) => {
  if (!domElement) {
    return {
      top: null,
      bottom: null,
      left: null,
      right: null,
      height: null,
      width: null,
    };
  }
  return {
    top: domElement.getBoundingClientRect().top + window.scrollY,
    bottom: domElement.getBoundingClientRect().bottom + window.scrollY,
    left: domElement.getBoundingClientRect().left + window.scrollX,
    right: domElement.getBoundingClientRect().right + window.scrollX,
    height: domElement.getBoundingClientRect().height,
    width: domElement.getBoundingClientRect().width,
  };
};

const getScrollCoordsFromElement = (domElement) => {
  const domElementCoords = getElementCoords(domElement);
  if (
    domElementCoords.top === null ||
    domElementCoords.bottom === null ||
    domElementCoords.left === null ||
    domElementCoords.right === null ||
    domElementCoords.height === null ||
    domElementCoords.width === null
  ) {
    console.error("getScrollCoordsFromElement: No domElement found");
    return {
      windowTop: {
        fromTop: null,
        fromBetweenTopMiddle: null,
        fromMiddle: null,
        fromBetweenMiddleBottom: null,
        fromBottom: null,
      },
      windowBottom: {
        fromTop: null,
        fromBetweenTopMiddle: null,
        fromMiddle: null,
        fromBetweenMiddleBottom: null,
        fromBottom: null,
      },
      windowRight: {
        fromRight: null,
        fromLeft: null,
      },
    };
  }
  return {
    windowTop: {
      fromTop: window.scrollY - domElementCoords.top,
      fromBetweenTopMiddle:
        window.scrollY - (domElementCoords.top + domElementCoords.height / 4),
      fromMiddle:
        window.scrollY - (domElementCoords.top + domElementCoords.height / 2),
      fromBetweenMiddleBottom:
        window.scrollY -
        (domElementCoords.bottom - domElementCoords.height / 4),
      fromBottom: window.scrollY - domElementCoords.bottom,
    },
    windowBottom: {
      fromTop: window.scrollY + window.innerHeight - domElementCoords.top,
      fromBetweenTopMiddle:
        window.scrollY +
        window.innerHeight -
        (domElementCoords.top + domElementCoords.height / 4),
      fromMiddle:
        window.scrollY +
        window.innerHeight -
        (domElementCoords.top + domElementCoords.height / 2),
      fromBetweenMiddleBottom:
        window.scrollY +
        window.innerHeight -
        (domElementCoords.bottom - domElementCoords.height / 4),
      fromBottom: window.scrollY + window.innerHeight - domElementCoords.bottom,
    },
    windowRight: {
      fromRight: window.innerWidth - domElementCoords.right,
      fromLeft: window.innerWidth - domElementCoords.left,
    },
  };
};

const isElementVisible = (domElement) => {
  const domElementCoords = getElementCoords(domElement);
  if (
    domElementCoords.top === null ||
    domElementCoords.bottom === null ||
    domElementCoords.left === null ||
    domElementCoords.right === null ||
    domElementCoords.height === null ||
    domElementCoords.width === null
  ) {
    console.error("isElementVisible: No domElement found");
    return {
      partable: {
        x: false,
        y: false,
      },
      fully: {
        x: false,
        y: false,
      },
    };
  }
  return {
    partable: {
      x:
        domElementCoords.right >= 0 &&
        domElementCoords.left <= window.innerWidth,
      y:
        domElementCoords.bottom >= window.scrollY &&
        domElementCoords.top <= window.scrollY + window.innerHeight,
    },
    fully: {
      x:
        domElementCoords.right <= window.innerWidth &&
        domElementCoords.left >= 0,
      y:
        domElementCoords.bottom <= window.scrollY + window.innerHeight &&
        domElementCoords.top >= window.scrollY,
    },
  };
};

export { getElementCoords, getScrollCoordsFromElement, isElementVisible };
