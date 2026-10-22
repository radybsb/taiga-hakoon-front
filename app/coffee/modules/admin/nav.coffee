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
        # Permission-dependent entries may be inserted by ng-if after linking.
        $scope.$watch (-> $el.find("#adminmenu-#{section}")[0]), (item) ->
            return unless item
            $el.find(".active").removeClass("active")
            angular.element(item).addClass("active")

        $scope.$on "$destroy", ->
            $el.off()

    return {link:link}

module = angular.module("taigaAdmin")
module.directive("tgAdminNavigation", AdminNavigationDirective)
