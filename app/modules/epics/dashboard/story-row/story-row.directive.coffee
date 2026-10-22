###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

module = angular.module('taigaEpics')

StoryRowDirective = () ->
    link = (scope, el, attrs, ctrl) ->
        scope.$on 'detail-popup:updated', (event, detail) ->
            if detail.type == 'us' && ctrl.story.get('id') == detail.item.id
                ctrl.story = ctrl.story.merge(Immutable.fromJS(detail.item._attrs))
    return {
        link: link,
        templateUrl:"epics/dashboard/story-row/story-row.html",
        controller: "StoryRowCtrl",
        controllerAs: "vm",
        bindToController: true,
        scope: {
            story: '=',
            options: '='
        }
    }

module.directive("tgStoryRow", StoryRowDirective)
