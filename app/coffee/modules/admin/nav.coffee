###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

AdminNavigationDirective = ->
    link = ($scope, $el, $attrs) ->
        section = $attrs.tgAdminNavigation
        $scope.settingsNavigation = {section: section, open: section, collapsed: false}
        # ng-if can insert navigation entries after this directive links.
        $scope.$watch (-> $el.find("#adminmenu-#{section}")[0]), (item) ->
            return unless item
            angular.element(item).addClass("active")
        subsection = $attrs.tgAdminSubsection
        if subsection
            $scope.$watch (-> $el.find("#adminmenu-#{subsection}")[0]), (item) ->
                angular.element(item).addClass("active") if item

        $scope.$on "$destroy", ->
            $el.off()

    return {link:link}

module = angular.module("taigaAdmin")
module.directive("tgAdminNavigation", AdminNavigationDirective)
