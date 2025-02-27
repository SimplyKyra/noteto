import Options from './utils/Options.js';
import BlockTypes from './blocks.js';
import Config from './config.js';
import RenderFonts from './utils/RenderFonts.js';
import RenderLibrary from './utils/RenderLibrary.js';
import RenderOptions from './utils/RenderOptions.js';
import RenderTemplates from './utils/RenderTemplates.js';
import GraphicUtils from './utils/GraphicUtils.js';
import GridUtils from './utils/GridUtils.js';
import TransferUtils from './utils/TransferUtils.js';
import Gallery from './gallery/Gallery.js';
import Helpers from './utils/Helpers.js';

/** *******************
 * Global Variables
 ******************** */

/* global interact */

const paperSvg = document.getElementById('paper-svg');
const blocksGroup = document.getElementById('blocks-group');
const optionsBox = document.getElementById('options-box');

let globalOptions = new Options({});
let blocks = {};
let grid = {};

/** *******************
 * LISTENERS
 ******************** */

function updateGlobalOptions() {
  // Add new options (if there are some)
  Object.values(blocks).forEach((block) => {
    globalOptions.addGlobal(block.opts);
  });

  // Identify orphaned options (in case block was deleted)
  let orphanedOptions = Object.keys(globalOptions);
  Object.values(blocks).forEach((block) => {
    Object.keys(block.opts).forEach((optName) => {
      if (orphanedOptions.indexOf(optName) >= 0) {
        orphanedOptions = orphanedOptions.filter((e) => e !== optName);
      }
    });
  });
  globalOptions.delete(orphanedOptions);
}

function onBlockChange() {
  updateGlobalOptions();
  const boxTitle = optionsBox.querySelector('p.box-title');
  const selectedBlock = document.querySelector('.dragit.selected');

  if (!selectedBlock) {
    RenderOptions.renderOptions(globalOptions, onOptionChange);
    optionsBox.removeAttribute('data-blockid');
    boxTitle.textContent = 'Global Options';
  } else {
    optionsBox.setAttribute('data-blockid', selectedBlock.id);
    boxTitle.textContent = 'Block Options';
    RenderOptions.renderOptions(blocks[selectedBlock.id].opts, onOptionChange);
  }

  // If no blocks are left, we can hide the options box
  if (Object.keys(blocks).length === 0) {
    optionsBox.setAttribute('data-blockid', 'none');
  }
}

function onClickBlockInLibrary(BlockClass) {
  // Insert new block instance into root svg
  const newBlock = new BlockClass(grid);
  newBlock.opts.inherit(globalOptions);
  newBlock.addTo(blocksGroup);
  blocks[newBlock.id] = newBlock;
  onBlockChange();
}

function onClickDeleteBlockBtn() {
  const blockId = optionsBox.getAttribute('data-blockid');

  // Remove SVG
  const blockRoot = document.getElementById(blockId);
  blockRoot.parentElement.removeChild(blockRoot);

  // Remove entry from blocks dict
  delete blocks[blockId];

  onBlockChange();
}

function onFileLoaded(obj) {
  // Validate roughly
  if (!('grid' in obj && 'blocks' in obj && 'globalOptions' in obj)) {
    console.error('JSON file didn\'t contain the expected data.');
    return;
  }
  [blocks, globalOptions] = RenderTemplates.loadTemplate(obj, blocksGroup, grid);
}

function onClickLoadFileBtn() {
  TransferUtils.uploadJsonFromDisk(onFileLoaded);
}

function onClickEditJsonBtn(event) {
  const { target } = event;
  const template = target.getAttribute('data-template');
  const url = `js/gallery/${template}/${template}.json`;
  TransferUtils.loadJsonFromUrl(url, onFileLoaded);
  onClickGalleryBtn();
}

function onClickSaveFileBtn() {
  // Compose object with necessary data
  const data = {};
  data.blocks = blocks;
  data.grid = grid;
  data.globalOptions = globalOptions;
  TransferUtils.downloadObjectAsJson(data, 'noteto-template.json');
}

function onDragMove(event) {
  const id = event.target.getAttribute('id');
  const ratio = Helpers.getRatio(paperSvg);

  // keep the dragged position in the data-x/data-y attributes
  const x = (parseFloat(blocks[id].dataX) || 0) + (event.dx * ratio);
  const y = (parseFloat(blocks[id].dataY) || 0) + (event.dy * ratio);

  // translate the element
  blocks[id].root.style.webkitTransform = `translate(${x}px,${y}px)`;
  blocks[id].root.style.transform = `translate(${x}px,${y}px)`;

  // update the posiion attributes
  blocks[id].dataX = x;
  blocks[id].dataY = y;

  blocks[id].render();
}

function onResizeMove(event) {
  const { target } = event;
  const id = target.getAttribute('id');
  const ratio = Helpers.getRatio(paperSvg);

  // keep the dragged position in the data-x/data-y attributes
  let x = parseFloat(blocks[id].dataX) || 0;
  let y = parseFloat(blocks[id].dataY) || 0;

  blocks[id].width = event.rect.width * ratio;
  blocks[id].height = event.rect.height * ratio;

  // translate when resizing from top or left edges
  x += event.deltaRect.left * ratio;
  y += event.deltaRect.top * ratio;

  blocks[id].root.style.webkitTransform = `translate(${x}px,${y}px)`;
  blocks[id].root.style.transform = `translate(${x}px,${y}px)`;

  blocks[id].dataX = x;
  blocks[id].dataY = y;

  blocks[id].render();
}

function castFormValue(dataType, target) {
  if (dataType === 'number') return parseInt(target.value, 10);
  if (dataType === 'checkbox') return target.checked;
  return target.value;
}

function onOptionChange(event) {
  const { target } = event;

  const dataType = target.getAttribute('type').toLowerCase();
  const optName = target.getAttribute('data-option');
  const optValue = castFormValue(dataType, target);

  const blockId = optionsBox.getAttribute('data-blockid');

  // If we are in global scope, update and re-render all blocks
  if (!blockId) {
    globalOptions[optName].value = optValue;
    Object.keys(blocks).forEach((id) => {
      blocks[id].opts.setGlobal(optName, optValue);
      blocks[id].render();
    });
  } else {
    // Update Option
    blocks[blockId].opts.set(optName, optValue);
    // If we are in block scope, handle the "use Global" checkbox...
    if (optName === 'useGlobal') {
      RenderOptions.renderOptions(blocks[blockId].opts, onOptionChange);
      if (optValue === true) {
        blocks[blockId].opts.inherit(globalOptions);
      }
      onBlockChange();
    }
    // ...then set update option and re-render block
    blocks[blockId].render();
  }
}

function onClickGalleryBtn() {
  document.documentElement.classList.toggle('is-clipped');
  document.getElementById('gallery-modal').classList.toggle('is-active');
}

function onClickBlock(event) {
  const { currentTarget } = event;

  currentTarget.classList.toggle('selected');

  // Clear "selected" from all blocks except the clicked one
  const allBlocks = document.querySelectorAll('.dragit');
  for (let i = 0; i < allBlocks.length; i += 1) {
    if (allBlocks[i] !== currentTarget) {
      allBlocks[i].classList.remove('selected');
    }
  }
  onBlockChange();
}

function onClickCanvas(event) {
  // Clear "selected" from all blocks
  if (event.target === paperSvg) {
    const allBlocks = document.querySelectorAll('.dragit');
    for (let i = 0; i < allBlocks.length; i += 1) {
      allBlocks[i].classList.remove('selected');
    }
    onBlockChange();
  }
}

function onClickToFrontOrBackBtn(event) {
  const container = document.getElementById('options-box');
  const blockId = container.getAttribute('data-blockid');

  // Reorder SVG
  const blockRoot = document.getElementById(blockId);
  const rootParent = blockRoot.parentElement;
  rootParent.removeChild(blockRoot);

  const newBlocks = {};
  if (event.currentTarget.getAttribute('id') === 'front-button') {
    rootParent.append(blockRoot);
    Object.entries(blocks).forEach(([id, block]) => {
      if (id !== blockId) newBlocks[id] = block;
    });
    newBlocks[blockId] = blocks[blockId];
  } else {
    rootParent.prepend(blockRoot);
    newBlocks[blockId] = blocks[blockId];
    Object.entries(blocks).forEach(([id, block]) => {
      if (id !== blockId) newBlocks[id] = block;
    });
  }
  blocks = newBlocks;
}

function onFontsLoaded(callback) {
  window.setTimeout(() => {
    const countFonts = document.querySelectorAll('#font-defs > style').length;
    if (countFonts >= Object.keys(Config.fonts).length) {
      callback();
    } else {
      onFontsLoaded(callback);
    }
  }, 200);
}

function onClickDownloadPngBtn() {
  GraphicUtils.convertSvgToCanvas(paperSvg, (canvas) => {
    TransferUtils.downloadCanvasAsPng(canvas, 'noteto-template.png');
  });
}

function onClickViewCheckbox(event) {
  const { target } = event;
  const option = target.getAttribute('data-option');
  if (option) {
    const group = document.getElementById(option);
    group.classList.toggle('hidden');
  }
}

function initInteract() {
  // Define restrictions for resize/drag interactions
  const snapTarget = [interact.snappers.grid(grid)];
  const resizeRestrictions = [
    interact.modifiers.snap({
      targets: snapTarget,
      range: Infinity,
      relativePoints: [{ x: 0, y: 0 }],
    }),
    interact.modifiers.restrictSize({
      min: { width: grid.size * 3, height: grid.size * 3 },
    }),
    interact.modifiers.restrictEdges({
      outer: grid.restriction,
    }),
  ];
  const dragRestrictions = [
    interact.modifiers.snap({
      targets: snapTarget,
      range: Infinity,
      relativePoints: [{ x: 0, y: 0 }],
    }),
    interact.modifiers.restrictRect({
      restriction: grid.restriction,
    }),
  ];

  // Remove inteactables (in case of resizing etc.)
  interact('.dragit').unset();

  // Set inteactables
  interact('.dragit')
    .draggable({
      modifiers: dragRestrictions,
      restrict: {
        restriction: 'parent',
        endOnly: false,
        elementRect: {
          top: 0,
          left: 0,
          bottom: 1,
          right: 1,
        },
      },
      autoScroll: true,
      onmove: onDragMove,
      onend: () => { },
    })
    .resizable({
      edges: {
        left: true,
        right: true,
        bottom: true,
        top: true,
      },
      listeners: {
        move: onResizeMove,
      },
      modifiers: resizeRestrictions,
      margin: 7,
    })
    .on('tap', onClickBlock);
}

/** *******************
 * INIT
 ******************** */
function init() {
  // Add Load font files and add to svg style
  RenderFonts.appendFontData(paperSvg);
  onFontsLoaded(() => {
    const libraryEl = document.getElementById('library');
    RenderLibrary.renderBlockLibrary(libraryEl, BlockTypes, onClickBlockInLibrary);
  });

  grid = GridUtils.calcGrid(paperSvg);

  Gallery.renderGallery(document.getElementById('gallery-content'));

  // Prevent default events for dragging
  document.addEventListener('dragstart', (event) => event.preventDefault());

  // Various listeners
  document.getElementById('export-button').addEventListener('click', onClickDownloadPngBtn);
  document.getElementById('load-button').addEventListener('click', onClickLoadFileBtn);
  document.getElementById('save-button').addEventListener('click', onClickSaveFileBtn);
  document.getElementById('delete-button').addEventListener('click', onClickDeleteBlockBtn);
  document.getElementById('front-button').addEventListener('click', onClickToFrontOrBackBtn);
  document.getElementById('back-button').addEventListener('click', onClickToFrontOrBackBtn);
  document.getElementById('gallery-button').addEventListener('click', onClickGalleryBtn);
  document.getElementById('gallery-close-button').addEventListener('click', onClickGalleryBtn);
  document.getElementById('gallery-close-button').addEventListener('click', onClickGalleryBtn);
  document.querySelectorAll('#gallery-content a.edit-json').forEach((el) => {
    el.addEventListener('click', onClickEditJsonBtn);
  });
  document.querySelectorAll('#view-box input[type="checkbox"]').forEach((el) => {
    el.addEventListener('click', onClickViewCheckbox);
  });

  paperSvg.addEventListener('click', onClickCanvas);
  window.addEventListener('resize', initInteract);

  // Calculate grid dimensions and restrictions
  initInteract();
  GraphicUtils.renderRemarkableElements(paperSvg);
  GraphicUtils.renderRemarkableElementsLefthand(paperSvg);
  GraphicUtils.renderGuideLines(paperSvg);
  GraphicUtils.renderGridLines(paperSvg);
}

// wait for external resources to load if any
window.addEventListener('load', () => {
  init();
});
