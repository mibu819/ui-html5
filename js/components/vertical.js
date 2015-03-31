(function (manywho) {

    var vertical = React.createClass({
        
        render: function () {
            
            log.info('Rendering Vertical: ' + this.props.id);

            var model = manywho.model.getContainer(this.props.id, this.props.flowKey);
            var classes = manywho.styling.getClasses(this.props.parentId, this.props.id, "vertical_flow", this.props.flowKey).join(' ');
            var children = manywho.model.getChildren(this.props.id, this.props.flowKey);
            
            return React.DOM.div({ className: classes, id: this.props.id }, [
                React.DOM.h3({ className: 'container-label' }, model.label),
                manywho.component.getChildComponents(children, this.props.id, this.props.flowKey)
            ]);

        }

    });

    manywho.component.register("vertical_flow", vertical);

    manywho.styling.registerContainer("vertical_flow", function (item, container) {

        var classes = [];

        if (manywho.utils.isEqual(item.componentType, 'input', true)
            && item.size == 0
            && (manywho.utils.isEqual(item.contentType, manywho.component.contentTypes.string, true)
            || manywho.utils.isEqual(item.contentType, manywho.component.contentTypes.password, true)
            || manywho.utils.isEqual(item.contentType, manywho.component.contentTypes.number, true))) {

            classes.push('auto-width');

        }

        return classes;

    });

}(manywho));