###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

module = angular.module("taigaComponents")

cardSlideshowDirective = () ->
    link = (scope, el, attrs, ctrl) ->
        scope.$watch 'vm.images.size', (size) ->
            ctrl.index = 0 if ctrl.index >= size
    return {
        link: link,
        controller: "CardSlideshow",
        templateUrl: "components/card-slideshow/card-slideshow.html",
        bindToController: true,
        controllerAs: "vm",
        scope: {
            images: "="
        }
    }

module.directive('tgCardSlideshow', cardSlideshowDirective)
