/*
 * This source code is licensed under the terms of the
 * GNU Affero General Public License found in the LICENSE file in
 * the root directory of this source tree.
 *
 * Copyright (c) 2021-present Kaleidos INC
 */

(function() {
    var multipleSortableClass = 'ui-multisortable-multiple';
    var mainClass = 'main-drag-item';
    var inProgress = false;
    var removeEventFn = null;

    var reset = function(elm) {
        $(elm)
            .removeAttr('style')
            .removeClass('tg-multiple-drag-mirror')
            .removeClass('multiple-drag-mirror')
            .data('dragMultipleIndex', null)
            .data('dragMultipleActive', false);
    };

    var drag = function() {
        var shadow = dragMultiple.items.shadow;

        // Each copy can have a different height (wrapped titles, tags, etc.).
        // Measure the rendered copies and accumulate their heights on either
        // side of the primary mirror instead of multiplying one row height.
        var bounds = shadow[0].getBoundingClientRect();
        var gap = shadow.hasClass('us-item-row') ? 8 : 0;
        var above = bounds.top;
        var below = bounds.bottom + gap;
        var items = dragMultiple.items.draggingItems.slice().sort(function(a, b) {
            return Math.abs(a.data('dragMultipleIndex')) - Math.abs(b.data('dragMultipleIndex'));
        });

        $('.gu-transit').addClass('gu-transit-multi');

        _.forEach(items, function(elm) {
            var elmIndex = parseInt(elm.data('dragMultipleIndex'), 10);
            var height = elm.outerHeight();
            var top;
            if (elmIndex < 0) {
                above -= height + gap;
                top = above;
            } else {
                top = below;
                below += height + gap;
            }
            elm.css({top: top, left: bounds.left});
        });
    };

    var stop = function() {
        inProgress = false;

        refreshOriginal();

        document.documentElement.removeEventListener('mousemove', removeEventFn);

        // reset
        dragMultiple.items = {};

        $('.' + mainClass).removeClass(mainClass);
        $('.tg-multiple-drag-mirror').remove();
        $('.multiple-drag-mirror').removeClass('multiple-drag-mirror');

        $('.tg-multiple-drag-dragging')
            .removeClass('tg-multiple-drag-dragging')
            .show();

        $('.gu-transit-multi').removeClass('gu-transit-multi');

        return $('.' + multipleSortableClass);
    };

    var refreshOriginal = function() {
        var index = parseInt(dragMultiple.items.elm.data('dragMultipleIndex'), 10);

        var after = [];
        var before = [];

        _.forEach(dragMultiple.items.draggedItemsOriginal, function(item) {
            if (parseInt($(item).data('dragMultipleIndex'), 10) > index) {
                after.push(item);
            } else {
                before.push(item);
            }
        });

        after.reverse();

        _.forEach(after, function(item) {
            $(item).insertAfter(dragMultiple.items.elm);
        });

        _.forEach(before, function(item) {
            $(item).insertBefore(dragMultiple.items.elm);
        });
    };


    var isMultiple = function(elm, container) {
        var items = $(container).find('.' + multipleSortableClass);

        if (!$(elm).hasClass(multipleSortableClass) || !(items.length > 1)) {
            return false;
        }

        return true;
    };

    var setIndex = function(items) {
        var before = [];
        var after = [];
        var mainFound = false;
        _.forEach(items, function(item, index) {
            if ($(item).data('dragMultipleIndex') === 0) {
                mainFound = true;
                return;
            }

            if (mainFound) {
                after.push(item);
            } else {
                before.push(item);
            }
        });

        before.reverse();

        _.forEach(after, function(item, index)  {
            $(item).data('dragMultipleIndex', index + 1);
        });

        _.forEach(before, function(item, index)  {
            $(item).data('dragMultipleIndex', -index - 1);
        });
    };

    var dragMultiple = {};

    dragMultiple.prepare = function(elm, container) {
        inProgress = true;

        var items = $(container).find('.' + multipleSortableClass);

        _.forEach(items, function(item, index) {
            $(item)
                .data('position', null)
                .data('dragMultipleIndex', null);
        });

        $(elm)
            .data('dragmultiple:originalPosition', $(elm).position())
            .data('dragMultipleActive', true);

        dragMultiple.items = {};

        dragMultiple.items.elm = $(elm);
        dragMultiple.items.container = $(container);

        dragMultiple.items.elm.data('dragMultipleIndex', 0);

        setIndex(items);

        dragMultiple.items.shadow = $('.gu-mirror');

        dragMultiple.items.elm.addClass(mainClass);

        items = _.filter(items, function(item) {
            return !$(item).hasClass(mainClass);
        });

        dragMultiple.items.draggedItemsOriginal = items;

        var itemsCloned = _.map(items, function (item) {
            var clone = $(item).clone(true);

            clone
                .addClass('multiple-drag-mirror')
                .addClass('tg-multiple-drag-mirror')
                .data('dragmultiple:originalPosition', $(item).position())
                .data('dragMultipleActive', true)
                .css({
                    zIndex: '9999',
                    opacity: '0.8',
                    position: 'fixed',
                    width: dragMultiple.items.elm.outerWidth(),
                    height: $(item).hasClass('us-item-row') ? 'auto' : $(item).outerHeight()
                });

            $(item)
                .hide()
                .addClass('tg-multiple-drag-dragging');

            return clone;
        });

        dragMultiple.items.draggingItems = itemsCloned;

        $(document.body).append(itemsCloned);
    };

    dragMultiple.start = function(item, container) {
        if (isMultiple(item, container)) {
            document.documentElement.addEventListener('mousemove', function() {
                if (!inProgress) {
                    dragMultiple.prepare(item, container);
                }

                drag();

                removeEventFn = arguments.callee;
            });
        }
    };

    dragMultiple.stop = function() {
        if (inProgress) {
            return stop();
        } else {
            return [];
        }
    };

    dragMultiple.getElements = function() {
        return $('.' + multipleSortableClass);
    };

    window.dragMultiple = dragMultiple;
}());
