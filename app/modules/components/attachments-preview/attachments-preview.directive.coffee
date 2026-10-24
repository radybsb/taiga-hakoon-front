###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

AttachmentPreviewLightboxDirective = (lightboxService, attachmentsPreviewService) ->
    link = ($scope, el, attrs, ctrl) ->
        ctrl.deleteCurrent = ->
            attachment = ctrl.getCurrentAttachment()
            return unless attachment
            ctrl.onDelete({attachment: attachment})

        isTopmost = ->
            opened = lightboxService.opened
            return !opened?.length || opened[opened.length - 1] == el[0]

        $scope.$watch (-> attachmentsPreviewService.fileId), (fileId) ->
            if !fileId && el.hasClass('open') && !el.hasClass('close-started')
                lightboxService.close(el)

        # Only a complete click in free space closes the viewer. A drag or
        # text selection starting on media/controls must leave it open.
        protectedTarget = (target) ->
            return $(target).closest('img, video, a, button, input, textarea, select, label, [contenteditable="true"], .attachment-preview-editor').length > 0
        startedInFreeSpace = false
        endedInFreeSpace = false
        el.on 'pointerdown.attachment-dismiss', (event) ->
            startedInFreeSpace = event.button == 0 && !protectedTarget(event.target)
            endedInFreeSpace = false
        el.on 'pointerup.attachment-dismiss', (event) ->
            endedInFreeSpace = startedInFreeSpace && !protectedTarget(event.target)
        el.on 'pointercancel.attachment-dismiss', ->
            startedInFreeSpace = endedInFreeSpace = false
        el.on 'click.attachment-dismiss', (event) ->
            shouldClose = startedInFreeSpace && endedInFreeSpace && !protectedTarget(event.target)
            startedInFreeSpace = endedInFreeSpace = false
            return unless shouldClose && isTopmost() && el.hasClass('open') && !el.hasClass('close-started')
            event.preventDefault()
            event.stopImmediatePropagation()
            $scope.$evalAsync -> lightboxService.close(el)

        keydown = (e) ->
            return unless isTopmost()
            return unless el.hasClass('open') && !el.hasClass('close-started') && attachmentsPreviewService.fileId
            return unless e.keyCode in [37, 39]
            # Native video controls retarget their keyboard events to the video.
            # Preserve seeking while the player has focus, even if the event
            # is dispatched elsewhere; otherwise arrows navigate the carousel.
            return if $(e.target).closest('input, textarea, select, [contenteditable="true"]').length
            focused = document.activeElement
            return if $(e.target).closest('video').length
            return if el[0].contains(focused) && $(focused).closest('video').length
            e.preventDefault()
            $scope.$evalAsync ->
                if e.keyCode == 39 then ctrl.next() else ctrl.previous()
            return
        $(document.body).on('keydown.image-preview', keydown)

        stopVideos = ->
            el[0].querySelectorAll('video').forEach (video) -> video.pause()

        $scope.$on 'lightbox:closed', ->
            if el.hasClass('close-started')
                stopVideos()
                ctrl.editing = false
                attachmentsPreviewService.fileId = null

        $scope.$on '$destroy', () ->
            stopVideos()
            el.off('.attachment-dismiss')
            $(document.body).off('keydown.image-preview', keydown)

    return {
        scope: {},
        controller: 'AttachmentsPreview',
        templateUrl: 'components/attachments-preview/attachments-preview.html',
        link: link,
        controllerAs: "vm",
        bindToController: {
            attachments: "="
            type: "@"
            onUpdate: "&"
            onDelete: "&"
        }
    }

angular.module('taigaComponents').directive("tgAttachmentsPreview", [
    "lightboxService",
    "tgAttachmentsPreviewService",
    AttachmentPreviewLightboxDirective])
