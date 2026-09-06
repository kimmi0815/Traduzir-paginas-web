'use strict';
// pageTranslator initializes in the preceding script's promise microtask.
if (typeof pageTranslator.translatePage !== 'function') throw new Error('Translation sample initialization failed');
if (parent.motionStudy) parent.motionStudy.ready(frameElement);
else parent.addEventListener('load', () => parent.motionStudy?.ready(frameElement), {once:true});
