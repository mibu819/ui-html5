/*!
 Copyright 2015 ManyWho, Inc.
 Licensed under the ManyWho License, Version 1.0 (the "License"); you may not use this
 file except in compliance with the License.
 You may obtain a copy of the License at: http://manywho.com/sharedsource
 Unless required by applicable law or agreed to in writing, software distributed under
 the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the specific language governing
 permissions and limitations under the License.
 */

(function (manywho) {

    var iframe = React.createClass({

        render: function () {

            manywho.log.info('Rendering iframe: ' + this.props.id);

            var classes = manywho.styling.getClasses(this.props.parentId, this.props.id, 'iframe', this.props.flowKey);
            var model = manywho.model.getComponent(this.props.id, this.props.flowKey);
            var outcomes = manywho.model.getOutcomes(this.props.id, this.props.flowKey);

            var outcomeButtons = outcomes && outcomes.map(function (outcome) {
                return React.createElement(manywho.component.getByName('outcome'), { id: outcome.id, flowKey: this.props.flowKey });
            }, this);

            return React.DOM.div({ className: classes.join(' ') }, [
                React.DOM.iframe({ src: model.imageUri, width: model.width, height: model.height, id: this.props.id, frameBorder: 0 }, null),
                outcomeButtons
            ]);

        }

    });

    manywho.component.register("iframe", iframe);

}(manywho));
